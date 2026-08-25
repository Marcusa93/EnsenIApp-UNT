import type { DbClient } from "@/lib/courses";
import type { Activity, Enums, UserRole } from "@/lib/types/helpers";
import type { Submission } from "./model";

/* Helpers de lectura (server-only por uso; no importan módulos de cliente). */

export interface ActivityClassRef {
  id: string;
  topic: string;
  class_date: string;
}

export interface TeacherActivityRow extends Activity {
  class: ActivityClassRef | null;
  assigned_count: number;
  submitted_count: number;
  graded_count: number;
  in_progress_count: number;
}

export interface EnrolledStudent {
  id: string;
  full_name: string;
  email: string;
  status: Enums<"profile_status">;
}

export interface ClassOption {
  id: string;
  course_id: string;
  topic: string;
  class_date: string;
}

export interface MaterialOption {
  id: string;
  class_id: string;
  title: string;
  kind: Enums<"material_kind">;
  url: string | null;
  storage_path: string | null;
}

export interface StudentActivityRow extends Activity {
  class: ActivityClassRef | null;
  submission: Submission | null;
}

function oneOf<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const ACTIVITY_SELECT = "*, class:classes(id, topic, class_date)" as const;

/** Actividades de los cursos del docente con contadores de asignación/entregas. */
export async function getTeacherActivityRows(supabase: DbClient, courseIds: string[]): Promise<TeacherActivityRow[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .in("course_id", courseIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[activities] getTeacherActivityRows", { courseIds, error });
    throw new Error("No se pudieron cargar las actividades.");
  }
  const activities = data ?? [];
  const ids = activities.map((a) => a.id);

  const enrolledByCourse = new Map<string, number>();
  const assignedByActivity = new Map<string, number>();
  const subsByActivity = new Map<string, { submitted: number; graded: number; inProgress: number }>();

  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id")
    .in("course_id", courseIds)
    .eq("status", "active");
  if (enrollError) console.error("[activities] enrollments count", enrollError);
  (enrollments ?? []).forEach((e) => enrolledByCourse.set(e.course_id, (enrolledByCourse.get(e.course_id) ?? 0) + 1));

  if (ids.length > 0) {
    const [assignRes, subRes] = await Promise.all([
      supabase.from("activity_assignments").select("activity_id").in("activity_id", ids),
      supabase.from("activity_submissions").select("activity_id, status").in("activity_id", ids),
    ]);
    if (assignRes.error) console.error("[activities] assignments count", assignRes.error);
    if (subRes.error) console.error("[activities] submissions count", subRes.error);
    (assignRes.data ?? []).forEach((a) =>
      assignedByActivity.set(a.activity_id, (assignedByActivity.get(a.activity_id) ?? 0) + 1),
    );
    (subRes.data ?? []).forEach((s) => {
      const cur = subsByActivity.get(s.activity_id) ?? { submitted: 0, graded: 0, inProgress: 0 };
      if (s.status === "entregada") cur.submitted++;
      else if (s.status === "corregida") {
        cur.submitted++;
        cur.graded++;
      } else cur.inProgress++;
      subsByActivity.set(s.activity_id, cur);
    });
  }

  return activities.map((a) => {
    const subs = subsByActivity.get(a.id) ?? { submitted: 0, graded: 0, inProgress: 0 };
    return {
      ...a,
      class: oneOf(a.class as ActivityClassRef | ActivityClassRef[] | null),
      assigned_count:
        a.target === "todos" ? (enrolledByCourse.get(a.course_id) ?? 0) : (assignedByActivity.get(a.id) ?? 0),
      submitted_count: subs.submitted,
      graded_count: subs.graded,
      in_progress_count: subs.inProgress,
    };
  });
}

/** Una actividad (con clase) visible para el usuario actual según RLS. */
export async function getActivityById(
  supabase: DbClient,
  activityId: string,
): Promise<(Activity & { class: ActivityClassRef | null }) | null> {
  const { data, error } = await supabase.from("activities").select(ACTIVITY_SELECT).eq("id", activityId).maybeSingle();
  if (error) {
    console.error("[activities] getActivityById", { activityId, error });
    throw new Error("No se pudo cargar la actividad.");
  }
  if (!data) return null;
  return { ...data, class: oneOf(data.class as ActivityClassRef | ActivityClassRef[] | null) };
}

/** Inscriptos activos de un curso (RLS: el docente ve a sus estudiantes). */
export async function getEnrolledStudents(supabase: DbClient, courseId: string): Promise<EnrolledStudent[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("student_id, student:profiles(id, full_name, email, status)")
    .eq("course_id", courseId)
    .eq("status", "active");
  if (error) {
    console.error("[activities] getEnrolledStudents", { courseId, error });
    throw new Error("No se pudieron cargar los estudiantes inscriptos.");
  }
  return (data ?? [])
    .map((row) => oneOf(row.student as EnrolledStudent | EnrolledStudent[] | null))
    .filter((s): s is EnrolledStudent => s != null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
}

export async function getCourseClasses(supabase: DbClient, courseIds: string[]): Promise<ClassOption[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("classes")
    .select("id, course_id, topic, class_date")
    .in("course_id", courseIds)
    .order("class_date", { ascending: false });
  if (error) {
    console.error("[activities] getCourseClasses", { courseIds, error });
    throw new Error("No se pudieron cargar las clases.");
  }
  return data ?? [];
}

export async function getMaterialsForClasses(supabase: DbClient, classIds: string[]): Promise<MaterialOption[]> {
  if (classIds.length === 0) return [];
  const { data, error } = await supabase
    .from("class_materials")
    .select("id, class_id, title, kind, url, storage_path")
    .in("class_id", classIds)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[activities] getMaterialsForClasses", { classIds, error });
    throw new Error("No se pudieron cargar los materiales.");
  }
  return data ?? [];
}

/** Materiales puntuales vinculados a una actividad (content.material_ids). */
export async function getMaterialsByIds(supabase: DbClient, materialIds: string[]): Promise<MaterialOption[]> {
  if (materialIds.length === 0) return [];
  const { data, error } = await supabase
    .from("class_materials")
    .select("id, class_id, title, kind, url, storage_path")
    .in("id", materialIds);
  if (error) {
    console.error("[activities] getMaterialsByIds", { materialIds, error });
    throw new Error("No se pudieron cargar los materiales de la actividad.");
  }
  return data ?? [];
}

export async function getAssignedStudentIds(supabase: DbClient, activityId: string): Promise<string[]> {
  const { data, error } = await supabase.from("activity_assignments").select("student_id").eq("activity_id", activityId);
  if (error) {
    console.error("[activities] getAssignedStudentIds", { activityId, error });
    throw new Error("No se pudieron cargar los destinatarios.");
  }
  return (data ?? []).map((r) => r.student_id);
}

/** ¿El usuario puede administrar este curso? (admin siempre; docente si está asignado). */
export async function isTeacherOfCourse(
  supabase: DbClient,
  userId: string,
  role: UserRole,
  courseId: string,
): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "docente") return false;
  const { data, error } = await supabase
    .from("teacher_assignments")
    .select("course_id")
    .eq("teacher_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) {
    console.error("[activities] isTeacherOfCourse", { userId, courseId, error });
    return false;
  }
  return Boolean(data);
}

/** Actividades visibles para el estudiante (RLS: publicadas/cerradas + destinatario) con su entrega. */
export async function getStudentActivities(supabase: DbClient, studentId: string): Promise<StudentActivityRow[]> {
  const [actRes, subRes] = await Promise.all([
    supabase.from("activities").select(ACTIVITY_SELECT).neq("status", "draft").order("created_at", { ascending: false }),
    supabase.from("activity_submissions").select("*").eq("student_id", studentId),
  ]);
  if (actRes.error) {
    console.error("[activities] getStudentActivities", { studentId, error: actRes.error });
    throw new Error("No se pudieron cargar tus actividades.");
  }
  if (subRes.error) {
    console.error("[activities] getStudentActivities submissions", { studentId, error: subRes.error });
    throw new Error("No se pudieron cargar tus entregas.");
  }
  const subs = new Map((subRes.data ?? []).map((s) => [s.activity_id, s]));
  return (actRes.data ?? []).map((a) => ({
    ...a,
    class: oneOf(a.class as ActivityClassRef | ActivityClassRef[] | null),
    submission: subs.get(a.id) ?? null,
  }));
}

export interface SubmissionStudentRef {
  id: string;
  full_name: string;
  email: string;
}

export interface SubmissionWithStudent extends Submission {
  student: SubmissionStudentRef | null;
}

const SUBMISSION_SELECT = "*, student:profiles!activity_submissions_student_id_fkey(id, full_name, email)" as const;

/** Entregas de una actividad con el perfil del estudiante (RLS: docente del curso). */
export async function getSubmissionsForActivity(
  supabase: DbClient,
  activityId: string,
): Promise<SubmissionWithStudent[]> {
  const { data, error } = await supabase
    .from("activity_submissions")
    .select(SUBMISSION_SELECT)
    .eq("activity_id", activityId)
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[activities] getSubmissionsForActivity", { activityId, error });
    throw new Error("No se pudieron cargar las entregas.");
  }
  return (data ?? []).map((s) => ({
    ...s,
    student: oneOf(s.student as SubmissionStudentRef | SubmissionStudentRef[] | null),
  }));
}

export async function getSubmissionById(supabase: DbClient, submissionId: string): Promise<SubmissionWithStudent | null> {
  const { data, error } = await supabase
    .from("activity_submissions")
    .select(SUBMISSION_SELECT)
    .eq("id", submissionId)
    .maybeSingle();
  if (error) {
    console.error("[activities] getSubmissionById", { submissionId, error });
    throw new Error("No se pudo cargar la entrega.");
  }
  if (!data) return null;
  return { ...data, student: oneOf(data.student as SubmissionStudentRef | SubmissionStudentRef[] | null) };
}

/** Entrega del estudiante actual para una actividad (null si no empezó). */
export async function getOwnSubmission(
  supabase: DbClient,
  activityId: string,
  studentId: string,
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from("activity_submissions")
    .select("*")
    .eq("activity_id", activityId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) {
    console.error("[activities] getOwnSubmission", { activityId, studentId, error });
    throw new Error("No se pudo cargar tu entrega.");
  }
  return data;
}

export interface RecordingContext {
  id: string;
  title: string | null;
  class_id: string;
  course_id: string;
  class_topic: string;
}

/** Grabación + clase + curso (RLS: docente del curso). */
export async function getRecordingContext(supabase: DbClient, recordingId: string): Promise<RecordingContext | null> {
  const { data, error } = await supabase
    .from("class_recordings")
    .select("id, title, class_id, class:classes(id, course_id, topic)")
    .eq("id", recordingId)
    .maybeSingle();
  if (error) {
    console.error("[activities] getRecordingContext", { recordingId, error });
    throw new Error("No se pudo cargar la grabación.");
  }
  if (!data) return null;
  const cls = oneOf(data.class as { id: string; course_id: string; topic: string } | { id: string; course_id: string; topic: string }[] | null);
  if (!cls) return null;
  return { id: data.id, title: data.title, class_id: data.class_id, course_id: cls.course_id, class_topic: cls.topic };
}

/** URL firmada (1 h) para un objeto del bucket class-materials; null si falla. */
export async function signMaterialUrl(supabase: DbClient, storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("class-materials").createSignedUrl(storagePath, 3600);
  if (error) {
    console.error("[activities] signMaterialUrl", { storagePath, error });
    return null;
  }
  return data?.signedUrl ?? null;
}
