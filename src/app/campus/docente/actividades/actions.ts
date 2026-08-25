"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/types/database";
import type { TablesUpdate } from "@/lib/types/helpers";
import { createClient } from "@/lib/supabase/server";
import { requireTeacherOf } from "@/components/docente/teacher-guard";
import { errorMessage } from "@/lib/utils";
import {
  activityInputSchema,
  firstIssue,
  quizContentSchema,
  textContentSchema,
  type ActionResult,
  type ActivityInput,
  type ActivityStatus,
} from "@/components/activities/model";
import { getSubmissionsForActivity } from "@/components/activities/queries";
import { buildSubmissionsCsv, csvFileName } from "@/components/activities/csv";

const BASE = "/campus/docente/actividades";
const STUDENT_BASE = "/campus/estudiante/actividades";

function revalidateActivity(activityId?: string) {
  revalidatePath(BASE);
  revalidatePath("/campus/docente");
  revalidatePath(STUDENT_BASE);
  revalidatePath("/campus/estudiante");
  if (activityId) {
    revalidatePath(`${BASE}/${activityId}`);
    revalidatePath(`${STUDENT_BASE}/${activityId}`);
  }
}

/** Carga la actividad y verifica que el usuario sea docente del curso. Lanza si no corresponde. */
async function loadOwnedActivity(activityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").select("*").eq("id", activityId).maybeSingle();
  if (error) {
    console.error("[actividades] loadOwnedActivity", { activityId, error });
    throw new Error("No se pudo cargar la actividad.");
  }
  if (!data) throw new Error("La actividad no existe o no tenés acceso.");
  const guard = await requireTeacherOf(data.course_id);
  return { activity: data, ...guard };
}

async function syncAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  activityId: string,
  target: "todos" | "seleccionados",
  studentIds: string[],
  assignedBy: string,
) {
  if (target === "todos") {
    const { error } = await supabase.from("activity_assignments").delete().eq("activity_id", activityId);
    if (error) throw new Error(`No se pudieron limpiar los destinatarios: ${error.message}`);
    return;
  }
  const { data: existing, error: readErr } = await supabase
    .from("activity_assignments")
    .select("student_id")
    .eq("activity_id", activityId);
  if (readErr) throw new Error(`No se pudieron leer los destinatarios: ${readErr.message}`);
  const current = new Set((existing ?? []).map((r) => r.student_id));
  const wanted = new Set(studentIds);
  const toRemove = [...current].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !current.has(id));
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("activity_assignments")
      .delete()
      .eq("activity_id", activityId)
      .in("student_id", toRemove);
    if (error) throw new Error(`No se pudieron quitar destinatarios: ${error.message}`);
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("activity_assignments")
      .insert(toAdd.map((student_id) => ({ activity_id: activityId, student_id, assigned_by: assignedBy })));
    if (error) throw new Error(`No se pudieron agregar destinatarios: ${error.message}`);
  }
}

export interface SaveActivityOptions {
  activityId?: string;
  /** Publicar en el mismo paso (setea published_at si no lo tenía). */
  publish?: boolean;
}

/** Crea o actualiza una actividad (contenido + destinatarios). */
export async function saveActivity(
  raw: ActivityInput,
  opts: SaveActivityOptions = {},
): Promise<ActionResult<{ id: string }>> {
  const parsed = activityInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  try {
    const { supabase, ctx } = await requireTeacherOf(input.course_id);

    // Contenido normalizado según tipo (ya validado por el superRefine).
    const content =
      input.type === "cuestionario" ? quizContentSchema.parse(input.content) : textContentSchema.parse(input.content);

    // Verificar que el estudiantado seleccionado pertenezca al curso.
    if (input.target === "seleccionados") {
      const { data: enrolled, error } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("course_id", input.course_id)
        .eq("status", "active")
        .in("student_id", input.student_ids);
      if (error) throw new Error("No se pudo verificar la inscripción de los destinatarios.");
      const valid = new Set((enrolled ?? []).map((e) => e.student_id));
      const invalid = input.student_ids.filter((id) => !valid.has(id));
      if (invalid.length > 0) {
        return { ok: false, error: "Algunos destinatarios no están inscriptos en el curso. Revisá la selección." };
      }
    }

    if (input.class_id) {
      const { data: cls } = await supabase.from("classes").select("course_id").eq("id", input.class_id).maybeSingle();
      if (!cls || cls.course_id !== input.course_id) return { ok: false, error: "La clase elegida no pertenece al curso." };
    }

    const base = {
      course_id: input.course_id,
      class_id: input.class_id,
      recording_id: input.recording_id,
      type: input.type,
      title: input.title,
      instructions_md: input.instructions_md.trim() || null,
      content: content as unknown as Json,
      target: input.target,
      due_at: input.due_at,
      max_score: input.max_score,
    };

    let id = opts.activityId;
    if (id) {
      const { activity } = await loadOwnedActivity(id);
      const patch: TablesUpdate<"activities"> = { ...base };
      if (opts.publish && activity.status !== "published") {
        patch.status = "published";
        patch.published_at = activity.published_at ?? new Date().toISOString();
      }
      const { error } = await supabase.from("activities").update(patch).eq("id", id);
      if (error) throw new Error(`No se pudo guardar la actividad: ${error.message}`);
    } else {
      const { data, error } = await supabase
        .from("activities")
        .insert({
          ...base,
          created_by: ctx.user.id,
          status: opts.publish ? "published" : "draft",
          published_at: opts.publish ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`No se pudo crear la actividad: ${error?.message ?? "sin respuesta"}`);
      id = data.id;
    }

    await syncAssignments(supabase, id, input.target, input.student_ids, ctx.user.id);
    revalidateActivity(id);
    return { ok: true, data: { id } };
  } catch (err) {
    console.error("[actividades] saveActivity", err);
    return { ok: false, error: errorMessage(err, "No se pudo guardar la actividad.") };
  }
}

const statusSchema = z.object({ activityId: z.guid(), status: z.enum(["draft", "published", "closed"]) });

/** Cambia el estado (draft → published setea published_at la primera vez). */
export async function setActivityStatus(activityId: string, status: ActivityStatus): Promise<ActionResult<void>> {
  const parsed = statusSchema.safeParse({ activityId, status });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    const { activity, supabase } = await loadOwnedActivity(activityId);
    if (activity.status === status) return { ok: true, data: undefined };
    const patch: { status: ActivityStatus; published_at?: string } = { status };
    if (status === "published" && !activity.published_at) patch.published_at = new Date().toISOString();
    const { error } = await supabase.from("activities").update(patch).eq("id", activityId);
    if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
    revalidateActivity(activityId);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[actividades] setActivityStatus", { activityId, status, err });
    return { ok: false, error: errorMessage(err) };
  }
}

/** Elimina una actividad (sólo borradores o sin entregas). */
export async function deleteActivity(activityId: string): Promise<ActionResult<void>> {
  if (!z.guid().safeParse(activityId).success) return { ok: false, error: "Identificador inválido." };
  try {
    const { activity, supabase } = await loadOwnedActivity(activityId);
    const { count, error: countErr } = await supabase
      .from("activity_submissions")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", activityId);
    if (countErr) throw new Error("No se pudo verificar si hay entregas.");
    if ((count ?? 0) > 0 && activity.status !== "draft") {
      return { ok: false, error: "La actividad tiene entregas. Cerrala en vez de eliminarla." };
    }
    const { error } = await supabase.from("activities").delete().eq("id", activityId);
    if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
    revalidateActivity(activityId);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[actividades] deleteActivity", { activityId, err });
    return { ok: false, error: errorMessage(err) };
  }
}

const gradeSchema = z.object({
  submissionId: z.guid(),
  score: z.number().min(0).nullable(),
  teacher_feedback_md: z.string().max(20_000),
  markGraded: z.boolean(),
});
export type GradeInput = z.input<typeof gradeSchema>;

/** Guarda puntaje + feedback; opcionalmente marca la entrega como corregida. */
export async function gradeSubmission(raw: GradeInput): Promise<ActionResult<void>> {
  const parsed = gradeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;
  try {
    const supabase = await createClient();
    const { data: sub, error } = await supabase
      .from("activity_submissions")
      .select("id, activity_id, status")
      .eq("id", input.submissionId)
      .maybeSingle();
    if (error) throw new Error("No se pudo cargar la entrega.");
    if (!sub) return { ok: false, error: "La entrega no existe o no tenés acceso." };
    const { activity, ctx } = await loadOwnedActivity(sub.activity_id);
    const max = activity.max_score ?? 10;
    if (input.score != null && input.score > max) {
      return { ok: false, error: `El puntaje no puede superar el máximo (${max}).` };
    }
    const patch: TablesUpdate<"activity_submissions"> = {
      score: input.score,
      teacher_feedback_md: input.teacher_feedback_md.trim() || null,
    };
    if (input.markGraded) {
      patch.status = "corregida";
      patch.graded_at = new Date().toISOString();
      patch.graded_by = ctx.user.id;
    }
    const { error: updErr } = await supabase.from("activity_submissions").update(patch).eq("id", input.submissionId);
    if (updErr) throw new Error(`No se pudo guardar la corrección: ${updErr.message}`);
    revalidateActivity(sub.activity_id);
    revalidatePath(`${BASE}/${sub.activity_id}/entregas/${input.submissionId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[actividades] gradeSubmission", { submissionId: input.submissionId, err });
    return { ok: false, error: errorMessage(err) };
  }
}

/** Reabre una entrega para que el estudiante la edite y vuelva a entregar. */
export async function reopenSubmission(submissionId: string): Promise<ActionResult<void>> {
  if (!z.guid().safeParse(submissionId).success) return { ok: false, error: "Identificador inválido." };
  try {
    const supabase = await createClient();
    const { data: sub, error } = await supabase
      .from("activity_submissions")
      .select("id, activity_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (error) throw new Error("No se pudo cargar la entrega.");
    if (!sub) return { ok: false, error: "La entrega no existe o no tenés acceso." };
    await loadOwnedActivity(sub.activity_id);
    const { error: updErr } = await supabase
      .from("activity_submissions")
      .update({ status: "reabierta", graded_at: null, graded_by: null })
      .eq("id", submissionId);
    if (updErr) throw new Error(`No se pudo reabrir: ${updErr.message}`);
    revalidateActivity(sub.activity_id);
    revalidatePath(`${BASE}/${sub.activity_id}/entregas/${submissionId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[actividades] reopenSubmission", { submissionId, err });
    return { ok: false, error: errorMessage(err) };
  }
}

/** CSV de entregas (el cliente lo descarga como archivo). */
export async function exportSubmissionsCsv(activityId: string): Promise<ActionResult<{ csv: string; filename: string }>> {
  if (!z.guid().safeParse(activityId).success) return { ok: false, error: "Identificador inválido." };
  try {
    const { activity, supabase } = await loadOwnedActivity(activityId);
    const rows = await getSubmissionsForActivity(supabase, activityId);
    return {
      ok: true,
      data: { csv: buildSubmissionsCsv(activity, rows), filename: csvFileName(activity.title) },
    };
  } catch (err) {
    console.error("[actividades] exportSubmissionsCsv", { activityId, err });
    return { ok: false, error: errorMessage(err, "No se pudo exportar el CSV.") };
  }
}
