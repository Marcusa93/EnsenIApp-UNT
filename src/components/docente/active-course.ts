import { cookies } from "next/headers";
import { getCoursesForRole, type CourseWithSubject, type DbClient } from "@/lib/courses";
import type { UserRole } from "@/lib/types/helpers";

/** Cookie que recuerda el curso activo del docente entre visitas. */
export const COURSE_COOKIE = "ensenia.course";

export interface ActiveCourseResult {
  /** Curso seleccionado (null si el docente no tiene cursos asignados). */
  course: CourseWithSubject | null;
  /** Todos los cursos que puede operar (para el selector). */
  courses: CourseWithSubject[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resuelve el curso activo del docente/admin con esta prioridad:
 * 1) `?course=<id>` en la URL, 2) cookie `ensenia.course`, 3) primer curso asignado.
 * Sólo acepta ids que pertenezcan a la lista de cursos visibles (RLS ya filtra).
 */
export async function getActiveCourse(
  supabase: DbClient,
  userId: string,
  role: UserRole,
  requestedCourseId?: string | string[] | null,
): Promise<ActiveCourseResult> {
  const courses = await getCoursesForRole(supabase, userId, role);
  if (courses.length === 0) return { course: null, courses };

  const requested = Array.isArray(requestedCourseId) ? requestedCourseId[0] : requestedCourseId;
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COURSE_COOKIE)?.value;

  const pick = (id: string | null | undefined) =>
    id && UUID_RE.test(id) ? (courses.find((c) => c.id === id) ?? null) : null;

  const course = pick(requested) ?? pick(fromCookie) ?? courses[0];
  return { course, courses };
}
