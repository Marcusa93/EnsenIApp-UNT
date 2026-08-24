import type { DbClient } from "@/lib/courses";
import type { Enums } from "@/lib/types/helpers";
import { fetchAll } from "@/components/docente/fetch-all";

export type ProfileStatus = Enums<"profile_status">;

export interface EnrolledStudent {
  id: string;
  full_name: string;
  email: string;
  status: ProfileStatus;
  last_seen_at: string | null;
  enrolled_at: string;
  events_7d: number;
  avg_difficulty: number | null;
  open_alerts: number;
  in_roster: boolean;
}

export interface RosterRow {
  id: string;
  email: string;
  full_name: string | null;
  dni: string | null;
  matched_profile_id: string | null;
  created_at: string;
}

export interface StudentsData {
  enrolled: EnrolledStudent[];
  roster: RosterRow[];
  /** Inscriptos con status pendiente que no figuran en el padrón. */
  pending: EnrolledStudent[];
  usageTruncated: boolean;
}

interface ProfileEmbed {
  id: string;
  full_name: string;
  email: string;
  status: ProfileStatus;
  last_seen_at: string | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Carga todo lo que necesita /campus/docente/estudiantes con el cliente RLS del docente. */
export async function getStudentsData(supabase: DbClient, courseId: string): Promise<StudentsData> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [enrollRes, rosterRes, alertsRes, classesRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, created_at, status, student:profiles!enrollments_student_id_fkey(id, full_name, email, status, last_seen_at)")
      .eq("course_id", courseId)
      .eq("status", "active"),
    supabase.from("roster").select("id, email, full_name, dni, matched_profile_id, created_at").eq("course_id", courseId).order("created_at", { ascending: false }),
    supabase.from("teacher_alerts").select("student_id").eq("course_id", courseId).eq("resolved", false),
    supabase.from("classes").select("id").eq("course_id", courseId),
  ]);

  const firstError = enrollRes.error ?? rosterRes.error ?? alertsRes.error ?? classesRes.error;
  if (firstError) {
    console.error("[estudiantes] getStudentsData", { courseId, error: firstError });
    throw new Error("No se pudieron cargar los estudiantes del curso.");
  }

  const profiles = (enrollRes.data ?? [])
    .map((r) => ({ enrolled_at: r.created_at, profile: one(r.student as ProfileEmbed | ProfileEmbed[] | null) }))
    .filter((r): r is { enrolled_at: string; profile: ProfileEmbed } => r.profile != null);
  const ids = profiles.map((p) => p.profile.id);
  const classIds = (classesRes.data ?? []).map((c) => c.id);

  const [usage, checkinsRes] = await Promise.all([
    ids.length
      ? fetchAll<{ student_id: string }>((from, to) =>
          supabase
            .from("usage_events")
            .select("student_id")
            .in("student_id", ids)
            .gte("created_at", since)
            .range(from, to),
        )
      : Promise.resolve({ rows: [] as { student_id: string }[], truncated: false }),
    ids.length && classIds.length
      ? supabase.from("student_checkins").select("student_id, difficulty").in("student_id", ids).in("class_id", classIds)
      : Promise.resolve({ data: [] as { student_id: string; difficulty: number }[], error: null }),
  ]);
  if (checkinsRes.error) {
    console.error("[estudiantes] check-ins", { courseId, error: checkinsRes.error });
    throw new Error("No se pudieron cargar los check-ins.");
  }

  const events = new Map<string, number>();
  for (const e of usage.rows) events.set(e.student_id, (events.get(e.student_id) ?? 0) + 1);
  const diffs = new Map<string, number[]>();
  for (const c of checkinsRes.data ?? []) diffs.set(c.student_id, [...(diffs.get(c.student_id) ?? []), c.difficulty]);
  const alerts = new Map<string, number>();
  for (const a of alertsRes.data ?? []) if (a.student_id) alerts.set(a.student_id, (alerts.get(a.student_id) ?? 0) + 1);

  const roster: RosterRow[] = rosterRes.data ?? [];
  const rosterEmails = new Set(roster.map((r) => r.email.toLowerCase()));
  const rosterMatched = new Set(roster.map((r) => r.matched_profile_id).filter((x): x is string => !!x));

  const enrolled: EnrolledStudent[] = profiles
    .map(({ enrolled_at, profile: p }) => {
      const d = diffs.get(p.id) ?? [];
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        status: p.status,
        last_seen_at: p.last_seen_at,
        enrolled_at,
        events_7d: events.get(p.id) ?? 0,
        avg_difficulty: d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : null,
        open_alerts: alerts.get(p.id) ?? 0,
        in_roster: rosterMatched.has(p.id) || rosterEmails.has(p.email.toLowerCase()),
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));

  return {
    enrolled,
    roster,
    pending: enrolled.filter((s) => s.status === "pendiente" && !s.in_roster),
    usageTruncated: usage.truncated,
  };
}
