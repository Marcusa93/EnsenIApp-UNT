"use server";

import { revalidatePath } from "next/cache";
import { requireTeacherOf, requireTeacherOfClass } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import {
  classSchema,
  fieldErrors,
  importSchema,
  uuidSchema,
  type ClassInput,
  type ImportInput,
} from "@/components/docente/class-schema";
import { errorMessage } from "@/lib/utils";

function revalidateClasses(classId?: string) {
  revalidatePath("/campus/docente");
  revalidatePath("/campus/docente/clases");
  revalidatePath("/campus/estudiante");
  revalidatePath("/campus/estudiante/clases");
  if (classId) {
    revalidatePath(`/campus/docente/clases/${classId}`);
    revalidatePath(`/campus/estudiante/clases/${classId}`);
  }
}

export async function createClass(input: ClassInput): Promise<ActionResult<{ id: string }>> {
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá los datos de la clase.", fieldErrors(parsed.error));
  try {
    const { supabase } = await requireTeacherOf(parsed.data.course_id);
    const { data, error } = await supabase.from("classes").insert(parsed.data).select("id").single();
    if (error) throw error;
    revalidateClasses(data.id);
    return succeed({ id: data.id });
  } catch (err) {
    console.error("[docente/clases] createClass", { err });
    return fail(errorMessage(err, "No se pudo crear la clase."));
  }
}

export async function updateClass(classId: string, input: ClassInput): Promise<ActionResult> {
  const id = uuidSchema.safeParse(classId);
  if (!id.success) return fail("Clase inválida.");
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá los datos de la clase.", fieldErrors(parsed.error));
  try {
    const { supabase, courseId } = await requireTeacherOfClass(id.data);
    if (courseId !== parsed.data.course_id) return fail("La clase no pertenece a ese curso.");
    const { class_date, topic, teacher_id, summary, sort_order } = parsed.data;
    const { error } = await supabase
      .from("classes")
      .update({ class_date, topic, teacher_id, summary, sort_order })
      .eq("id", id.data);
    if (error) throw error;
    revalidateClasses(id.data);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/clases] updateClass", { classId, err });
    return fail(errorMessage(err, "No se pudo guardar la clase."));
  }
}

export async function deleteClass(classId: string): Promise<ActionResult> {
  const id = uuidSchema.safeParse(classId);
  if (!id.success) return fail("Clase inválida.");
  try {
    const { supabase } = await requireTeacherOfClass(id.data);
    const { error } = await supabase.from("classes").delete().eq("id", id.data);
    if (error) throw error;
    revalidateClasses(id.data);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/clases] deleteClass", { classId, err });
    return fail(errorMessage(err, "No se pudo eliminar la clase."));
  }
}

/* ------------------------------------------------------------------ */
/* Importación masiva por CSV                                           */
/* ------------------------------------------------------------------ */

export interface ImportResult {
  inserted: number;
  /** Emails que no se pudieron vincular a un perfil docente (la clase se creó sin docente). */
  unresolvedEmails: string[];
}

export interface ImportRowError {
  row: number;
  message: string;
}

export async function importClasses(
  input: ImportInput,
): Promise<ActionResult<ImportResult> & { rowErrors?: ImportRowError[] }> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    const rowErrors: ImportRowError[] = [];
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "rows" && typeof issue.path[1] === "number") {
        rowErrors.push({ row: issue.path[1] + 1, message: `${String(issue.path[2] ?? "fila")}: ${issue.message}` });
      }
    }
    const general = parsed.error.issues.find((i) => i.path[0] !== "rows" || typeof i.path[1] !== "number");
    return { ...fail(general?.message ?? "Hay filas con errores."), rowErrors };
  }

  try {
    const { supabase, ctx } = await requireTeacherOf(parsed.data.course_id);

    const emails = Array.from(
      new Set(parsed.data.rows.map((r) => r.docente_email).filter((e): e is string => e != null)),
    );
    const byEmail = new Map<string, string>();
    if (emails.length) {
      const { data: staff, error } = await supabase
        .from("profiles")
        .select("id, email, role")
        .in("email", emails)
        .in("role", ["docente", "admin"]);
      if (error) throw error;
      for (const p of staff ?? []) byEmail.set(p.email.toLowerCase(), p.id);
      // El propio docente siempre se puede asignar, aunque RLS oculte otros perfiles.
      const own = ctx.profile.email?.toLowerCase();
      if (own && emails.includes(own)) byEmail.set(own, ctx.user.id);
    }

    const unresolved = new Set<string>();
    const rows = parsed.data.rows.map((r, i) => {
      const teacher_id = r.docente_email ? (byEmail.get(r.docente_email) ?? null) : null;
      if (r.docente_email && !teacher_id) unresolved.add(r.docente_email);
      return {
        course_id: parsed.data.course_id,
        class_date: r.fecha,
        topic: r.tema,
        summary: r.resumen,
        teacher_id,
        sort_order: i,
      };
    });

    const { error, count } = await supabase.from("classes").insert(rows, { count: "exact" });
    if (error) throw error;
    revalidateClasses();
    return succeed({ inserted: count ?? rows.length, unresolvedEmails: Array.from(unresolved) });
  } catch (err) {
    console.error("[docente/clases] importClasses", { err });
    return fail(errorMessage(err, "No se pudo importar el cronograma."));
  }
}
