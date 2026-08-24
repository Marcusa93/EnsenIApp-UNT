"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid("Identificador inválido.");
const roleSchema = z.enum(["estudiante", "docente", "admin"]);
const statusSchema = z.enum(["pendiente", "validado", "bloqueado"]);

const ADMIN_PATH = "/campus/admin";

/**
 * Verifica a mano que quien llama es admin antes de usar el cliente service-role.
 * Devuelve el cliente admin y el id del administrador.
 */
async function requireAdmin() {
  const ctx = await getOptionalUser();
  if (!ctx) throw new Error("Tu sesión expiró. Volvé a ingresar.");
  if (ctx.profile.status === "bloqueado") throw new Error("Tu cuenta está bloqueada.");
  if (ctx.profile.role !== "admin") throw new Error("Sólo un administrador puede hacer esto.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: la administración no puede operar.");
  }
  return { db: createAdminClient(), adminId: ctx.user.id };
}

function firstIssue(error: z.ZodError, fallback = "Datos inválidos."): string {
  return error.issues[0]?.message ?? fallback;
}

function failed(scope: string, err: unknown, fallback: string): ActionResult<never> {
  console.error(`[admin] ${scope}`, err);
  return { ok: false, error: errorMessage(err, fallback) };
}

function revalidateAdmin() {
  revalidatePath(ADMIN_PATH);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

const setRoleSchema = z.object({ userId: uuid, role: roleSchema });

export async function setUserRole(input: unknown): Promise<ActionResult> {
  const parsed = setRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { userId, role } = parsed.data;
  try {
    const { db, adminId } = await requireAdmin();
    if (userId === adminId && role !== "admin") {
      return { ok: false, error: "No podés quitarte el rol de administrador a vos mismo." };
    }
    const { error } = await db.from("profiles").update({ role }).eq("id", userId);
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("setUserRole", err, "No se pudo cambiar el rol.");
  }
}

const setStatusSchema = z.object({ userId: uuid, status: statusSchema });

export async function setUserStatus(input: unknown): Promise<ActionResult> {
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { userId, status } = parsed.data;
  try {
    const { db, adminId } = await requireAdmin();
    if (userId === adminId && status === "bloqueado") {
      return { ok: false, error: "No podés bloquear tu propia cuenta." };
    }
    const { error } = await db.from("profiles").update({ status }).eq("id", userId);
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("setUserStatus", err, "No se pudo cambiar el estado.");
  }
}

// ---------------------------------------------------------------------------
// Materias
// ---------------------------------------------------------------------------

const subjectSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres.").max(160, "Nombre demasiado largo."),
  description: z.string().trim().max(1000, "La descripción es demasiado larga.").optional().or(z.literal("")),
});

export async function upsertSubject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, name, description } = parsed.data;
  try {
    const { db } = await requireAdmin();
    const payload = { name, description: description ? description : null };
    const query = id
      ? db.from("subjects").update(payload).eq("id", id).select("id").single()
      : db.from("subjects").insert(payload).select("id").single();
    const { data, error } = await query;
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return failed("upsertSubject", err, "No se pudo guardar la materia.");
  }
}

export async function deleteSubject(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const { db } = await requireAdmin();
    const { count, error: countError } = await db
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", parsed.data.id);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `La materia tiene ${count} curso(s). Borrá o reasigná los cursos antes de eliminarla.`,
      };
    }
    const { error } = await db.from("subjects").delete().eq("id", parsed.data.id);
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("deleteSubject", err, "No se pudo eliminar la materia.");
  }
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

const courseSchema = z.object({
  id: uuid.optional(),
  subjectId: uuid,
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(120, "Nombre demasiado largo."),
  term: z.string().trim().min(2, "Indicá el período (p. ej. 2026).").max(40, "Período demasiado largo."),
});

export async function upsertCourse(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, subjectId, name, term } = parsed.data;
  try {
    const { db } = await requireAdmin();
    const payload = { subject_id: subjectId, name, term };
    const query = id
      ? db.from("courses").update(payload).eq("id", id).select("id").single()
      : db.from("courses").insert(payload).select("id").single();
    const { data, error } = await query;
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return failed("upsertCourse", err, "No se pudo guardar el curso.");
  }
}

export async function deleteCourse(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const { db } = await requireAdmin();
    const [enrolled, classes] = await Promise.all([
      db.from("enrollments").select("*", { count: "exact", head: true }).eq("course_id", parsed.data.id),
      db.from("classes").select("*", { count: "exact", head: true }).eq("course_id", parsed.data.id),
    ]);
    if (enrolled.error) throw enrolled.error;
    if (classes.error) throw classes.error;
    if ((enrolled.count ?? 0) > 0 || (classes.count ?? 0) > 0) {
      return {
        ok: false,
        error: `El curso tiene ${enrolled.count ?? 0} inscripto(s) y ${classes.count ?? 0} clase(s). Eliminarlo borraría todo en cascada; hacelo desde la base de datos si estás seguro.`,
      };
    }
    const { error } = await db.from("courses").delete().eq("id", parsed.data.id);
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("deleteCourse", err, "No se pudo eliminar el curso.");
  }
}

function generateEnrollmentCode(): string {
  // 8 caracteres alfanuméricos sin ambigüedad (sin 0/O/1/I/L), fácil de dictar en clase.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export async function regenerateEnrollmentCode(input: unknown): Promise<ActionResult<{ code: string }>> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const { db } = await requireAdmin();
    // Reintento acotado por si choca con el unique.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateEnrollmentCode();
      const { error } = await db.from("courses").update({ enrollment_code: code }).eq("id", parsed.data.id);
      if (!error) {
        revalidateAdmin();
        return { ok: true, data: { code } };
      }
      if (error.code !== "23505") throw error;
    }
    return { ok: false, error: "No se pudo generar un código único. Probá de nuevo." };
  } catch (err) {
    return failed("regenerateEnrollmentCode", err, "No se pudo regenerar el código.");
  }
}

// ---------------------------------------------------------------------------
// Docentes por curso
// ---------------------------------------------------------------------------

const assignmentSchema = z.object({ courseId: uuid, teacherId: uuid });

export async function assignTeacher(input: unknown): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { courseId, teacherId } = parsed.data;
  try {
    const { db } = await requireAdmin();
    const { data: teacher, error: teacherError } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", teacherId)
      .maybeSingle();
    if (teacherError) throw teacherError;
    if (!teacher) return { ok: false, error: "El usuario no existe." };
    if (teacher.role === "estudiante") {
      return { ok: false, error: "El usuario es estudiante. Cambiá su rol a docente antes de asignarlo." };
    }
    const { error } = await db
      .from("teacher_assignments")
      .upsert({ course_id: courseId, teacher_id: teacherId }, { onConflict: "teacher_id,course_id" });
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("assignTeacher", err, "No se pudo asignar el docente.");
  }
}

export async function unassignTeacher(input: unknown): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { courseId, teacherId } = parsed.data;
  try {
    const { db } = await requireAdmin();
    const { error } = await db
      .from("teacher_assignments")
      .delete()
      .eq("course_id", courseId)
      .eq("teacher_id", teacherId);
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("unassignTeacher", err, "No se pudo quitar el docente.");
  }
}

// ---------------------------------------------------------------------------
// Cuerpo docente (faculty)
// ---------------------------------------------------------------------------

const facultySchema = z.object({
  id: uuid.optional(),
  subjectId: uuid,
  fullName: z.string().trim().min(3, "Ingresá el nombre completo.").max(120, "Nombre demasiado largo."),
  position: z.string().trim().min(2, "Ingresá el cargo (p. ej. Profesor titular).").max(120, "Cargo demasiado largo."),
  rank: z.coerce.number().int("El orden debe ser un entero.").min(0).max(999).default(99),
  profileId: uuid.nullable().optional(),
});

export async function upsertFaculty(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = facultySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, subjectId, fullName, position, rank, profileId } = parsed.data;
  try {
    const { db } = await requireAdmin();
    const payload = {
      subject_id: subjectId,
      full_name: fullName,
      position,
      rank,
      profile_id: profileId ?? null,
    };
    const query = id
      ? db.from("faculty").update(payload).eq("id", id).select("id").single()
      : db.from("faculty").insert(payload).select("id").single();
    const { data, error } = await query;
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return failed("upsertFaculty", err, "No se pudo guardar el integrante del cuerpo docente.");
  }
}

export async function deleteFaculty(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const { db } = await requireAdmin();
    const { error } = await db.from("faculty").delete().eq("id", parsed.data.id);
    if (error) throw error;
    revalidateAdmin();
    return { ok: true, data: undefined };
  } catch (err) {
    return failed("deleteFaculty", err, "No se pudo eliminar el integrante.");
  }
}
