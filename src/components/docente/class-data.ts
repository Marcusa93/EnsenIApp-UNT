// Sólo para Server Components / Server Actions: recibe el cliente Supabase con RLS.
import type { DbClient } from "@/lib/courses";
import { TIME_ZONE } from "@/lib/format";
import type { Enums, Tables } from "@/lib/types/helpers";

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

export interface StaffOption {
  id: string;
  full_name: string;
  email: string;
  role: Enums<"user_role">;
}

export type ClassTemporalState = "pasada" | "hoy" | "proxima" | "futura";

export interface TeacherClassRow {
  id: string;
  course_id: string;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  teacher_id: string | null;
  teacher_name: string | null;
  recording: { status: Enums<"recording_status">; published: boolean; progress: number } | null;
  recordings_count: number;
  materials_count: number;
  checkins_count: number;
  state: ClassTemporalState;
}

export interface TeacherMaterial {
  id: string;
  title: string;
  kind: Enums<"material_kind">;
  url: string | null;
  storage_path: string | null;
  created_at: string;
  /** URL final (externa o firmada). Null si el archivo no pudo firmarse. */
  href: string | null;
}

export interface ClassAnnouncement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  class_id: string | null;
  author_name: string | null;
}

export interface CheckinComment {
  id: string;
  difficulty: number;
  comment: string;
  created_at: string;
  student_name: string | null;
}

export interface ClassQuestion {
  id: string;
  question: string;
  status: Enums<"question_status">;
  created_at: string;
  is_anonymous: boolean;
  student_name: string | null;
}

export interface StudentVoice {
  /** Índice 0 → dificultad 1 … índice 4 → dificultad 5 */
  distribution: number[];
  total: number;
  avg: number | null;
  comments: CheckinComment[];
  questions: ClassQuestion[];
}

export interface TeacherClassDetail {
  id: string;
  course_id: string;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  teacher_id: string | null;
  teacher_name: string | null;
  state: ClassTemporalState;
  announcements: ClassAnnouncement[];
  materials: TeacherMaterial[];
  voice: StudentVoice;
}

/* ------------------------------------------------------------------ */
/* Fechas                                                               */
/* ------------------------------------------------------------------ */

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hoy en Tucumán como YYYY-MM-DD (comparable con `classes.class_date`). */
export function todayYmd(): string {
  return ymdFmt.format(new Date());
}

export function temporalState(classDate: string, today = todayYmd()): ClassTemporalState {
  if (classDate < today) return "pasada";
  if (classDate === today) return "hoy";
  return "futura";
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

export const MATERIAL_BUCKET = "class-materials";
const SIGNED_URL_TTL = 60 * 60; // 1 h

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function logAndThrow(scope: string, error: unknown, message: string): never {
  console.error(`[docente/clases] ${scope}`, error);
  throw new Error(message);
}

/* ------------------------------------------------------------------ */
/* Queries                                                              */
/* ------------------------------------------------------------------ */

/**
 * Docentes y admins visibles para el selector "docente a cargo".
 * Nota: con RLS actual un docente sólo ve su propio perfil; un admin los ve todos
 * (ver supabase/migrations/pending/docente-panel-clases.sql).
 */
export async function getTeachingStaff(supabase: DbClient): Promise<StaffOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["docente", "admin"])
    .order("full_name", { ascending: true });
  if (error) logAndThrow("staff", error, "No se pudo cargar el cuerpo docente.");
  return data ?? [];
}

interface RawClassRow {
  id: string;
  course_id: string;
  class_date: string;
  topic: string;
  summary: string | null;
  sort_order: number;
  teacher_id: string | null;
  teacher: { full_name: string } | { full_name: string }[] | null;
  recordings:
    | { id: string; status: Enums<"recording_status">; published: boolean; progress: number; created_at: string }[]
    | null;
  materials: { id: string }[] | null;
  checkins: { id: string }[] | null;
}

/** Cronograma completo del curso con estado de grabación y conteos, para el docente. */
export async function getCourseClasses(supabase: DbClient, courseId: string): Promise<TeacherClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, course_id, class_date, topic, summary, sort_order, teacher_id, teacher:profiles(full_name), recordings:class_recordings(id, status, published, progress, created_at), materials:class_materials(id), checkins:student_checkins(id)",
    )
    .eq("course_id", courseId)
    .order("class_date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) logAndThrow("list", error, "No se pudo cargar el cronograma.");

  const today = todayYmd();
  let nextAssigned = false;
  return ((data ?? []) as unknown as RawClassRow[]).map((r) => {
    const latest = [...(r.recordings ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    let state = temporalState(r.class_date, today);
    if (state === "futura" && !nextAssigned) {
      state = "proxima";
      nextAssigned = true;
    }
    return {
      id: r.id,
      course_id: r.course_id,
      class_date: r.class_date,
      topic: r.topic,
      summary: r.summary,
      sort_order: r.sort_order,
      teacher_id: r.teacher_id,
      teacher_name: one(r.teacher)?.full_name ?? null,
      recording: latest ? { status: latest.status, published: latest.published, progress: latest.progress } : null,
      recordings_count: r.recordings?.length ?? 0,
      materials_count: r.materials?.length ?? 0,
      checkins_count: r.checkins?.length ?? 0,
      state,
    };
  });
}

interface RawMaterial {
  id: string;
  title: string;
  kind: Enums<"material_kind">;
  url: string | null;
  storage_path: string | null;
  created_at: string;
}

async function resolveMaterials(supabase: DbClient, rows: RawMaterial[]): Promise<TeacherMaterial[]> {
  return Promise.all(
    rows.map(async (m) => {
      if (m.storage_path) {
        const { data, error } = await supabase.storage
          .from(MATERIAL_BUCKET)
          .createSignedUrl(m.storage_path, SIGNED_URL_TTL);
        if (error || !data?.signedUrl) {
          console.error("[docente/clases] no se pudo firmar material", { id: m.id, path: m.storage_path, error });
          return { ...m, href: null };
        }
        return { ...m, href: data.signedUrl };
      }
      return { ...m, href: m.url };
    }),
  );
}

/** Detalle de una clase para el docente (null si no existe o RLS la oculta). */
export async function getTeacherClassDetail(
  supabase: DbClient,
  classId: string,
): Promise<TeacherClassDetail | null> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, course_id, class_date, topic, summary, sort_order, teacher_id, teacher:profiles(full_name)")
    .eq("id", classId)
    .maybeSingle();
  if (error) logAndThrow("detail", error, "No se pudo cargar la clase.");
  if (!cls) return null;

  const [annRes, matRes, checkinRes, questionRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, created_at, class_id, author:profiles(full_name)")
      .eq("course_id", cls.course_id)
      .or(`class_id.eq.${classId},class_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("class_materials")
      .select("id, title, kind, url, storage_path, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_checkins")
      .select("id, difficulty, comment, created_at, student:profiles!student_checkins_student_id_fkey(full_name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("student_questions")
      .select("id, question, status, created_at, is_anonymous, student:profiles!student_questions_student_id_fkey(full_name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (annRes.error) logAndThrow("announcements", annRes.error, "No se pudieron cargar los avisos.");
  if (matRes.error) logAndThrow("materials", matRes.error, "No se pudieron cargar los materiales.");
  if (checkinRes.error) logAndThrow("checkins", checkinRes.error, "No se pudieron cargar los check-ins.");
  if (questionRes.error) logAndThrow("questions", questionRes.error, "No se pudieron cargar las consultas.");

  const materials = await resolveMaterials(supabase, (matRes.data ?? []) as RawMaterial[]);

  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  const comments: CheckinComment[] = [];
  for (const c of checkinRes.data ?? []) {
    const d = Math.min(5, Math.max(1, c.difficulty));
    distribution[d - 1]++;
    sum += d;
    if (c.comment && c.comment.trim()) {
      comments.push({
        id: c.id,
        difficulty: d,
        comment: c.comment.trim(),
        created_at: c.created_at,
        student_name: one(c.student)?.full_name ?? null,
      });
    }
  }
  const total = checkinRes.data?.length ?? 0;

  return {
    id: cls.id,
    course_id: cls.course_id,
    class_date: cls.class_date,
    topic: cls.topic,
    summary: cls.summary,
    sort_order: cls.sort_order,
    teacher_id: cls.teacher_id,
    teacher_name: one(cls.teacher)?.full_name ?? null,
    state: temporalState(cls.class_date),
    announcements: (annRes.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      created_at: a.created_at,
      class_id: a.class_id,
      author_name: one(a.author)?.full_name ?? null,
    })),
    materials,
    voice: {
      distribution,
      total,
      avg: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
      comments: comments.slice(0, 40),
      questions: (questionRes.data ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        status: q.status,
        created_at: q.created_at,
        is_anonymous: q.is_anonymous,
        student_name: q.is_anonymous ? null : (one(q.student)?.full_name ?? null),
      })),
    },
  };
}

export type MaterialKind = Enums<"material_kind">;
export type AnnouncementRow = Tables<"announcements">;
