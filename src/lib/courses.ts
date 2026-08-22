import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Tables } from "@/lib/types/helpers";

export type DbClient = SupabaseClient<Database>;
export type Course = Tables<"courses">;
export type Subject = Tables<"subjects">;

export interface CourseWithSubject extends Course {
  subject: Pick<Subject, "id" | "name" | "description"> | null;
}

const COURSE_SELECT = "*, subject:subjects(id, name, description)" as const;

function normalize(rows: unknown[]): CourseWithSubject[] {
  return (rows as CourseWithSubject[]).map((r) => ({
    ...r,
    subject: Array.isArray(r.subject) ? ((r.subject[0] as CourseWithSubject["subject"]) ?? null) : r.subject,
  }));
}

/** Cursos donde el usuario está en teacher_assignments (RLS ya filtra; el join es explícito por claridad). */
export async function getTeacherCourses(supabase: DbClient, userId: string): Promise<CourseWithSubject[]> {
  const { data, error } = await supabase
    .from("teacher_assignments")
    .select(`course:courses(${COURSE_SELECT})`)
    .eq("teacher_id", userId);
  if (error) {
    console.error("[courses] getTeacherCourses", { userId, error });
    throw new Error("No se pudieron cargar tus cursos.");
  }
  const courses = (data ?? [])
    .map((row) => (row as { course: unknown }).course)
    .filter((c): c is NonNullable<typeof c> => c != null);
  return normalize(courses).sort((a, b) => b.term.localeCompare(a.term));
}

/** Cursos donde el usuario está inscripto (enrollments.status = 'active'). */
export async function getStudentCourses(supabase: DbClient, userId: string): Promise<CourseWithSubject[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`status, course:courses(${COURSE_SELECT})`)
    .eq("student_id", userId)
    .eq("status", "active");
  if (error) {
    console.error("[courses] getStudentCourses", { userId, error });
    throw new Error("No se pudieron cargar tus cursos.");
  }
  const courses = (data ?? [])
    .map((row) => (row as { course: unknown }).course)
    .filter((c): c is NonNullable<typeof c> => c != null);
  return normalize(courses).sort((a, b) => b.term.localeCompare(a.term));
}

/** Cursos según rol: docente/admin → asignados (admin: todos); estudiante → inscriptos. */
export async function getCoursesForRole(
  supabase: DbClient,
  userId: string,
  role: Database["public"]["Enums"]["user_role"],
): Promise<CourseWithSubject[]> {
  if (role === "admin") return getAllCourses(supabase);
  if (role === "docente") return getTeacherCourses(supabase, userId);
  return getStudentCourses(supabase, userId);
}

export async function getAllCourses(supabase: DbClient): Promise<CourseWithSubject[]> {
  const { data, error } = await supabase.from("courses").select(COURSE_SELECT).order("term", { ascending: false });
  if (error) {
    console.error("[courses] getAllCourses", { error });
    throw new Error("No se pudieron cargar los cursos.");
  }
  return normalize(data ?? []);
}

/** Un curso por id (null si no existe o RLS lo oculta). */
export async function getCourseById(supabase: DbClient, courseId: string): Promise<CourseWithSubject | null> {
  const { data, error } = await supabase.from("courses").select(COURSE_SELECT).eq("id", courseId).maybeSingle();
  if (error) {
    console.error("[courses] getCourseById", { courseId, error });
    throw new Error("No se pudo cargar el curso.");
  }
  return data ? normalize([data])[0] : null;
}

/** Primer curso del usuario (el caso habitual: comisión única). */
export async function getPrimaryCourse(
  supabase: DbClient,
  userId: string,
  role: Database["public"]["Enums"]["user_role"],
): Promise<CourseWithSubject | null> {
  const courses = await getCoursesForRole(supabase, userId, role);
  return courses[0] ?? null;
}
