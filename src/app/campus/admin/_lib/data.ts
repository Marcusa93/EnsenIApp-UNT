import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Enums, Tables } from "@/lib/types/helpers";

type DbClient = SupabaseClient<Database>;

export type AdminProfile = Pick<
  Tables<"profiles">,
  "id" | "full_name" | "email" | "role" | "status" | "avatar_url" | "created_at" | "last_seen_at"
>;

export type AdminSubject = Tables<"subjects">;

export interface AdminCourse extends Tables<"courses"> {
  subject: Pick<Tables<"subjects">, "id" | "name"> | null;
  enrolled: number;
  teachers: number;
}

export interface AdminAssignment {
  course_id: string;
  teacher_id: string;
  teacher: Pick<Tables<"profiles">, "id" | "full_name" | "email" | "role" | "avatar_url"> | null;
}

export interface AdminFaculty extends Tables<"faculty"> {
  profile: Pick<Tables<"profiles">, "id" | "full_name" | "email"> | null;
}

export interface TableCount {
  table: string;
  label: string;
  count: number | null;
  error?: string;
}

export interface EnvVarStatus {
  name: string;
  present: boolean;
  required: boolean;
  hint: string;
}

export interface FailedRecording {
  id: string;
  title: string | null;
  status: Enums<"recording_status">;
  current_step: string | null;
  error_message: string | null;
  created_at: string;
  class: Pick<Tables<"classes">, "id" | "topic" | "class_date"> | null;
}

export interface AdminData {
  profiles: AdminProfile[];
  subjects: AdminSubject[];
  courses: AdminCourse[];
  assignments: AdminAssignment[];
  faculty: AdminFaculty[];
}

export interface SystemData {
  env: EnvVarStatus[];
  counts: TableCount[];
  failedRecordings: FailedRecording[];
  pipeline: { status: Enums<"recording_status">; count: number }[];
}

function fail(scope: string, error: unknown): never {
  console.error(`[admin] ${scope}`, error);
  throw new Error(`No se pudo cargar ${scope}. Revisá la conexión con Supabase.`);
}

export async function getAdminData(db: DbClient): Promise<AdminData> {
  const [profilesRes, subjectsRes, coursesRes, assignmentsRes, facultyRes, enrollmentsRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email, role, status, avatar_url, created_at, last_seen_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    db.from("subjects").select("*").order("name"),
    db.from("courses").select("*, subject:subjects(id, name)").order("created_at", { ascending: false }),
    db
      .from("teacher_assignments")
      .select("course_id, teacher_id, teacher:profiles(id, full_name, email, role, avatar_url)"),
    db
      .from("faculty")
      .select("*, profile:profiles(id, full_name, email)")
      .order("rank", { ascending: true })
      .order("full_name", { ascending: true }),
    db.from("enrollments").select("course_id").eq("status", "active"),
  ]);

  if (profilesRes.error) fail("los usuarios", profilesRes.error);
  if (subjectsRes.error) fail("las materias", subjectsRes.error);
  if (coursesRes.error) fail("los cursos", coursesRes.error);
  if (assignmentsRes.error) fail("las asignaciones docentes", assignmentsRes.error);
  if (facultyRes.error) fail("el cuerpo docente", facultyRes.error);
  if (enrollmentsRes.error) fail("las inscripciones", enrollmentsRes.error);

  const enrolledByCourse = new Map<string, number>();
  for (const e of enrollmentsRes.data ?? []) {
    enrolledByCourse.set(e.course_id, (enrolledByCourse.get(e.course_id) ?? 0) + 1);
  }
  const teachersByCourse = new Map<string, number>();
  for (const a of assignmentsRes.data ?? []) {
    teachersByCourse.set(a.course_id, (teachersByCourse.get(a.course_id) ?? 0) + 1);
  }

  const courses: AdminCourse[] = (coursesRes.data ?? []).map((c) => ({
    ...c,
    enrolled: enrolledByCourse.get(c.id) ?? 0,
    teachers: teachersByCourse.get(c.id) ?? 0,
  }));

  return {
    profiles: profilesRes.data ?? [],
    subjects: subjectsRes.data ?? [],
    courses,
    assignments: assignmentsRes.data ?? [],
    faculty: facultyRes.data ?? [],
  };
}

const ENV_VARS: Omit<EnvVarStatus, "present">[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, hint: "URL del proyecto Supabase" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, hint: "Clave pública (anon) de Supabase" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, hint: "Service role: pipeline IA, informes, administración" },
  { name: "OPENROUTER_API_KEY", required: true, hint: "LLM y transcripción (OpenRouter)" },
  { name: "OPENROUTER_MODEL_REASONING", required: false, hint: "Override del modelo de razonamiento" },
  { name: "OPENROUTER_MODEL_FAST", required: false, hint: "Override del modelo rápido" },
  { name: "NEXT_PUBLIC_APP_URL", required: false, hint: "URL pública (metadata, links en emails)" },
  { name: "RESEND_API_KEY", required: false, hint: "Emails transaccionales (notificaciones)" },
  { name: "RESEND_FROM", required: false, hint: "Remitente de emails" },
  { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", required: false, hint: "Web Push (clave pública)" },
  { name: "VAPID_PRIVATE_KEY", required: false, hint: "Web Push (clave privada)" },
  { name: "VAPID_SUBJECT", required: false, hint: "Web Push (mailto:/URL de contacto)" },
  { name: "NEXT_PUBLIC_PWA_DEV", required: false, hint: "Activa el service worker en desarrollo (=1)" },
];

const COUNTED_TABLES: { table: keyof Database["public"]["Tables"]; label: string }[] = [
  { table: "profiles", label: "Usuarios" },
  { table: "roster", label: "Padrón" },
  { table: "courses", label: "Cursos" },
  { table: "enrollments", label: "Inscripciones" },
  { table: "classes", label: "Clases" },
  { table: "class_recordings", label: "Grabaciones" },
  { table: "transcripts", label: "Transcripciones" },
  { table: "class_summaries", label: "Resúmenes" },
  { table: "interactive_cards", label: "Placas" },
  { table: "activities", label: "Actividades" },
  { table: "activity_submissions", label: "Entregas" },
  { table: "student_questions", label: "Consultas" },
  { table: "student_checkins", label: "Check-ins" },
  { table: "debates", label: "Debates" },
  { table: "debate_arguments", label: "Argumentos" },
  { table: "usage_events", label: "Eventos de uso" },
  { table: "teacher_alerts", label: "Alertas" },
  { table: "report_requests", label: "Informes" },
];

const RECORDING_STATUSES: Enums<"recording_status">[] = [
  "uploaded",
  "transcribing",
  "processing",
  "generating",
  "ready",
  "error",
];

export async function getSystemData(db: DbClient): Promise<SystemData> {
  const env: EnvVarStatus[] = ENV_VARS.map((v) => ({
    ...v,
    present: Boolean(process.env[v.name] && process.env[v.name]!.trim().length > 0),
  }));

  const counts: TableCount[] = await Promise.all(
    COUNTED_TABLES.map(async ({ table, label }) => {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
      if (error) {
        console.error("[admin] count", { table, error });
        return { table, label, count: null, error: error.message };
      }
      return { table, label, count: count ?? 0 };
    }),
  );

  const [failedRes, ...statusRes] = await Promise.all([
    db
      .from("class_recordings")
      .select("id, title, status, current_step, error_message, created_at, class:classes(id, topic, class_date)")
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(15),
    ...RECORDING_STATUSES.map((status) =>
      db.from("class_recordings").select("*", { count: "exact", head: true }).eq("status", status),
    ),
  ]);

  if (failedRes.error) fail("las grabaciones con error", failedRes.error);

  const pipeline = RECORDING_STATUSES.map((status, i) => ({ status, count: statusRes[i]?.count ?? 0 }));

  return { env, counts, failedRecordings: failedRes.data ?? [], pipeline };
}
