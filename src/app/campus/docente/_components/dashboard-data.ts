import type { DbClient } from "@/lib/courses";
import type { Enums, Tables, Views } from "@/lib/types/helpers";
import { TIME_ZONE } from "@/lib/format";
import { fetchAll } from "@/components/docente/fetch-all";

export type AlertRow = Tables<"teacher_alerts"> & { student: { full_name: string } | null };

export interface UpcomingClass {
  id: string;
  topic: string;
  class_date: string;
  teacher_name: string | null;
  recording: { status: Enums<"recording_status">; published: boolean } | null;
}

export interface OpenQuestion {
  id: string;
  question: string;
  created_at: string;
  is_anonymous: boolean;
  student_name: string | null;
}

export interface RecordingInProgress {
  id: string;
  title: string | null;
  status: Enums<"recording_status">;
  progress: number;
  current_step: string | null;
  class_id: string;
  class_topic: string;
}

export interface UsageDay {
  /** YYYY-MM-DD (zona Tucumán) */
  date: string;
  events: number;
  students: number;
}

export interface DifficultyByClass {
  class_id: string;
  topic: string;
  class_date: string;
  avg: number;
  count: number;
}

export interface DashboardData {
  engagement: Views<"v_course_engagement"> | null;
  alerts: AlertRow[];
  upcomingClasses: UpcomingClass[];
  openQuestions: OpenQuestion[];
  recordingsInProgress: RecordingInProgress[];
  usageByDay: UsageDay[];
  usageTruncated: boolean;
  difficultyByClass: DifficultyByClass[];
}

export const USAGE_DAYS = 14;

type RecordingStatusRow = Pick<
  Views<"v_recording_status">,
  "id" | "title" | "status" | "progress" | "current_step" | "class_id" | "published"
>;

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD del instante dado, en la zona horaria de Tucumán. */
export function dayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function logAndThrow(scope: string, error: unknown, message: string): never {
  console.error(`[docente/panel] ${scope}`, error);
  throw new Error(message);
}

export async function getDashboardData(supabase: DbClient, courseId: string): Promise<DashboardData> {
  const today = dayKey(new Date());
  const since = new Date(Date.now() - (USAGE_DAYS - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);

  // Clases e inscriptos del curso: base para el resto de las consultas.
  const [classesRes, enrollmentsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, topic, class_date, teacher:profiles(full_name)")
      .eq("course_id", courseId)
      .order("class_date", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase.from("enrollments").select("student_id").eq("course_id", courseId).eq("status", "active"),
  ]);
  if (classesRes.error) logAndThrow("classes", classesRes.error, "No se pudieron cargar las clases del curso.");
  if (enrollmentsRes.error) logAndThrow("enrollments", enrollmentsRes.error, "No se pudieron cargar los inscriptos.");

  const classes = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    topic: c.topic,
    class_date: c.class_date,
    teacher_name: one(c.teacher)?.full_name ?? null,
  }));
  const classIds = classes.map((c) => c.id);
  const studentIds = (enrollmentsRes.data ?? []).map((e) => e.student_id);

  const [engagementRes, alertsRes, questionsRes, recordingsRes, usageRes, checkinsRes] = await Promise.all([
    supabase.from("v_course_engagement").select("*").eq("course_id", courseId).maybeSingle(),
    supabase
      .from("teacher_alerts")
      .select("*, student:profiles!teacher_alerts_student_id_fkey(full_name)")
      .eq("course_id", courseId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("student_questions")
      .select("id, question, created_at, is_anonymous, student:profiles!student_questions_student_id_fkey(full_name)")
      .eq("course_id", courseId)
      .eq("status", "abierta")
      .order("created_at", { ascending: false })
      .limit(6),
    classIds.length
      ? supabase
          .from("v_recording_status")
          .select("id, title, status, progress, current_step, class_id, published")
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as RecordingStatusRow[], error: null }),
    studentIds.length
      ? fetchAll<{ created_at: string; student_id: string }>((from, to) =>
          supabase
            .from("usage_events")
            .select("created_at, student_id")
            .in("student_id", studentIds)
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: true })
            .range(from, to),
        )
      : Promise.resolve({ rows: [] as { created_at: string; student_id: string }[], truncated: false }),
    classIds.length
      ? fetchAll<{ class_id: string; difficulty: number }>((from, to) =>
          supabase
            .from("student_checkins")
            .select("class_id, difficulty")
            .in("class_id", classIds)
            .order("created_at", { ascending: true })
            .range(from, to),
        )
      : Promise.resolve({ rows: [] as { class_id: string; difficulty: number }[], truncated: false }),
  ]).catch((error: unknown) => logAndThrow("aggregate", error, "No se pudieron cargar los datos del panel."));

  if (engagementRes.error) logAndThrow("engagement", engagementRes.error, "No se pudieron cargar los indicadores.");
  if (alertsRes.error) logAndThrow("alerts", alertsRes.error, "No se pudieron cargar las alertas.");
  if (questionsRes.error) logAndThrow("questions", questionsRes.error, "No se pudieron cargar las consultas.");
  if (recordingsRes.error) logAndThrow("recordings", recordingsRes.error, "No se pudo cargar el estado de las grabaciones.");

  const classById = new Map(classes.map((c) => [c.id, c]));

  // Última grabación por clase (la vista viene ordenada por created_at desc).
  const latestRecordingByClass = new Map<string, RecordingStatusRow>();
  const recordingsInProgress: RecordingInProgress[] = [];
  for (const r of recordingsRes.data ?? []) {
    if (!r.class_id || !r.id || !r.status) continue;
    if (!latestRecordingByClass.has(r.class_id)) latestRecordingByClass.set(r.class_id, r);
    if (r.status !== "ready") {
      recordingsInProgress.push({
        id: r.id,
        title: r.title,
        status: r.status,
        progress: r.progress ?? 0,
        current_step: r.current_step,
        class_id: r.class_id,
        class_topic: classById.get(r.class_id)?.topic ?? "Clase",
      });
    }
  }

  const upcomingClasses: UpcomingClass[] = classes
    .filter((c) => c.class_date >= today)
    .slice(0, 5)
    .map((c) => {
      const rec = latestRecordingByClass.get(c.id);
      return {
        ...c,
        recording: rec?.status ? { status: rec.status, published: rec.published ?? false } : null,
      };
    });

  // Uso por día (últimos 14 días, incluyendo días sin eventos).
  const byDay = new Map<string, { events: number; students: Set<string> }>();
  for (let i = 0; i < USAGE_DAYS; i++) {
    const d = new Date(Date.now() - (USAGE_DAYS - 1 - i) * 86_400_000);
    byDay.set(dayKey(d), { events: 0, students: new Set() });
  }
  for (const ev of usageRes.rows) {
    const key = dayKey(new Date(ev.created_at));
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.events++;
    bucket.students.add(ev.student_id);
  }
  const usageByDay: UsageDay[] = Array.from(byDay, ([date, b]) => ({
    date,
    events: b.events,
    students: b.students.size,
  }));

  // Dificultad promedio por clase (sólo clases con check-ins).
  const diff = new Map<string, { sum: number; count: number }>();
  for (const c of checkinsRes.rows) {
    const cur = diff.get(c.class_id) ?? { sum: 0, count: 0 };
    cur.sum += c.difficulty;
    cur.count++;
    diff.set(c.class_id, cur);
  }
  const difficultyByClass: DifficultyByClass[] = classes
    .filter((c) => diff.has(c.id))
    .map((c) => {
      const d = diff.get(c.id)!;
      return {
        class_id: c.id,
        topic: c.topic,
        class_date: c.class_date,
        avg: Math.round((d.sum / d.count) * 100) / 100,
        count: d.count,
      };
    });

  const alerts: AlertRow[] = (alertsRes.data ?? []).map((a) => ({
    ...a,
    student: one(a.student),
  }));

  const openQuestions: OpenQuestion[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    created_at: q.created_at,
    is_anonymous: q.is_anonymous,
    student_name: q.is_anonymous ? null : (one(q.student)?.full_name ?? null),
  }));

  return {
    engagement: engagementRes.data ?? null,
    alerts,
    upcomingClasses,
    openQuestions,
    recordingsInProgress,
    usageByDay,
    usageTruncated: usageRes.truncated,
    difficultyByClass,
  };
}
