import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types/helpers";

/**
 * Verificación manual de permisos antes de usar el cliente admin:
 * admin → siempre; docente → debe estar en teacher_assignments del curso.
 */
export async function isTeacherOfCourse(userId: string, role: UserRole, courseId: string): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "docente") return false;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_assignments")
    .select("course_id")
    .eq("teacher_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) {
    console.error("[reports/access] teacher_assignments", { userId, courseId, error });
    return false;
  }
  return data != null;
}

/** ¿El estudiante está inscripto en el curso? (para fichas e informes por estudiante). */
export async function isStudentEnrolled(studentId: string, courseId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) {
    console.error("[reports/access] enrollments", { studentId, courseId, error });
    return false;
  }
  return data != null;
}
