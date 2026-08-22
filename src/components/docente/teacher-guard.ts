import { getOptionalUser, type AuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DbClient } from "@/lib/courses";

export interface TeacherGuard {
  supabase: DbClient;
  ctx: AuthContext;
}

/**
 * Verifica que haya sesión y que el usuario sea docente del curso (o admin).
 * Usa el helper SQL `auth_is_teacher_of` además del rol del perfil, para que
 * las Server Actions no confíen sólo en RLS.
 * Lanza Error con mensaje en español si no corresponde.
 */
export async function requireTeacherOf(courseId: string): Promise<TeacherGuard> {
  const ctx = await getOptionalUser();
  if (!ctx) throw new Error("Tu sesión expiró. Volvé a ingresar.");
  if (ctx.profile.status === "bloqueado") throw new Error("Tu cuenta está bloqueada.");

  const supabase = await createClient();
  if (ctx.profile.role === "admin") return { supabase, ctx };
  if (ctx.profile.role !== "docente") throw new Error("Esta acción es sólo para docentes.");

  const { data: isTeacher, error } = await supabase.rpc("auth_is_teacher_of", { target_course: courseId });
  if (error) {
    console.error("[docente] auth_is_teacher_of", { courseId, userId: ctx.user.id, error });
    throw new Error("No se pudo verificar tu permiso sobre el curso.");
  }
  if (!isTeacher) throw new Error("No sos docente de este curso.");
  return { supabase, ctx };
}

/** Igual que `requireTeacherOf`, pero partiendo de una clase: devuelve además su course_id. */
export async function requireTeacherOfClass(classId: string): Promise<TeacherGuard & { courseId: string }> {
  const supabase = await createClient();
  const { data: cls, error } = await supabase.from("classes").select("id, course_id").eq("id", classId).maybeSingle();
  if (error) {
    console.error("[docente] requireTeacherOfClass", { classId, error });
    throw new Error("No se pudo cargar la clase.");
  }
  if (!cls) throw new Error("La clase no existe o no tenés acceso.");
  const guard = await requireTeacherOf(cls.course_id);
  return { ...guard, courseId: cls.course_id };
}
