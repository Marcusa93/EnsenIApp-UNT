"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";
import type { Json } from "@/lib/types/database";
import type { TablesUpdate } from "@/lib/types/helpers";
import {
  canStudentEdit,
  computeQuizScore,
  essayAnswersSchema,
  firstIssue,
  parseQuizContent,
  quizAnswersSchema,
  readingAnswersSchema,
  type ActionResult,
  type EditableType,
} from "@/components/activities/model";
import { getActivityById, getOwnSubmission } from "@/components/activities/queries";

const STUDENT_BASE = "/campus/estudiante/actividades";

const answersByType = {
  lectura: readingAnswersSchema,
  cuestionario: quizAnswersSchema,
  entrega: essayAnswersSchema,
} satisfies Record<EditableType, z.ZodType>;

const progressSchema = z.object({
  activityId: z.uuid(),
  answers: z.unknown(),
  /** Tiempo total acumulado (no un delta): el cliente lo lleva y el server nunca lo baja. */
  timeSpentSeconds: z.number().int().min(0).max(60 * 60 * 24 * 30),
});
export type ProgressInput = z.input<typeof progressSchema>;

/** Carga actividad + entrega propia y verifica que el estudiante pueda escribir. */
async function loadEditable(activityId: string) {
  const auth = await getOptionalUser();
  if (!auth) throw new Error("Tu sesión expiró. Volvé a ingresar.");
  if (auth.profile.status === "bloqueado") throw new Error("Tu cuenta está bloqueada.");

  const supabase = await createClient();
  const activity = await getActivityById(supabase, activityId);
  if (!activity) throw new Error("La actividad no existe o no tenés acceso.");
  if (activity.type === "placas" || activity.type === "debate" || activity.type === "encuesta") {
    throw new Error("Esta actividad se realiza desde su propio módulo.");
  }
  const submission = await getOwnSubmission(supabase, activityId, auth.user.id);
  if (!canStudentEdit(activity, submission)) {
    throw new Error(
      activity.status === "closed"
        ? "La actividad está cerrada: ya no se puede entregar."
        : "Tu entrega ya no se puede modificar.",
    );
  }
  return { auth, supabase, activity, submission };
}

/**
 * Autosave del borrador: upsert de answers + tiempo acumulado, en estado
 * en_progreso (o reabierta, si el docente la reabrió).
 */
export async function saveProgress(raw: ProgressInput): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = progressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  try {
    const { auth, supabase, activity, submission } = await loadEditable(input.activityId);
    const answersParsed = answersByType[activity.type as EditableType].safeParse(input.answers);
    if (!answersParsed.success) return { ok: false, error: firstIssue(answersParsed.error) };

    const timeSpent = Math.max(submission?.time_spent_seconds ?? 0, input.timeSpentSeconds);
    const { error } = await supabase.from("activity_submissions").upsert(
      {
        activity_id: input.activityId,
        student_id: auth.user.id,
        answers: answersParsed.data as unknown as Json,
        time_spent_seconds: timeSpent,
        status: submission?.status ?? "en_progreso",
      },
      { onConflict: "activity_id,student_id" },
    );
    if (error) throw new Error(`No se pudo guardar el borrador: ${error.message}`);
    return { ok: true, data: { savedAt: new Date().toISOString() } };
  } catch (err) {
    console.error("[actividades/estudiante] saveProgress", { activityId: input.activityId, err });
    return { ok: false, error: errorMessage(err, "No se pudo guardar el borrador.") };
  }
}

const submitSchema = progressSchema;
export type SubmitInput = z.input<typeof submitSchema>;

export interface SubmitResult {
  autoScore: number | null;
  correct: number | null;
  total: number | null;
}

/**
 * Entrega definitiva: valida las respuestas según el tipo, calcula auto_score
 * server-side para cuestionarios y marca la entrega como entregada.
 */
export async function submitActivity(raw: SubmitInput): Promise<ActionResult<SubmitResult>> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  try {
    const { auth, supabase, activity, submission } = await loadEditable(input.activityId);
    if (activity.status !== "published") {
      return { ok: false, error: "La actividad no está abierta para entregas." };
    }
    const type = activity.type as EditableType;
    const answersParsed = answersByType[type].safeParse(input.answers);
    if (!answersParsed.success) return { ok: false, error: firstIssue(answersParsed.error) };

    let autoScore: number | null = null;
    let correct: number | null = null;
    let total: number | null = null;

    if (type === "lectura") {
      const a = readingAnswersSchema.parse(answersParsed.data);
      if (!a.read) return { ok: false, error: "Marcá la lectura como leída antes de entregar." };
    } else if (type === "cuestionario") {
      const a = quizAnswersSchema.parse(answersParsed.data);
      const content = parseQuizContent(activity.content);
      const missing = content.questions.filter((q) => a.choices[q.id] === undefined);
      if (missing.length > 0) {
        return {
          ok: false,
          error:
            missing.length === 1
              ? "Te falta responder 1 pregunta."
              : `Te faltan responder ${missing.length} preguntas.`,
        };
      }
      const invalid = content.questions.some((q) => {
        const c = a.choices[q.id];
        return c === undefined || c < 0 || c >= q.options.length;
      });
      if (invalid) return { ok: false, error: "Hay respuestas inválidas. Recargá la página y probá de nuevo." };
      const result = computeQuizScore(content, a, activity.max_score ?? 10);
      autoScore = result.score;
      correct = result.correct;
      total = result.total;
    } else {
      const a = essayAnswersSchema.parse(answersParsed.data);
      if (!a.text.trim() && !a.file_path) {
        return { ok: false, error: "Escribí tu entrega o adjuntá un archivo antes de entregar." };
      }
    }

    const timeSpent = Math.max(submission?.time_spent_seconds ?? 0, input.timeSpentSeconds);
    const now = new Date().toISOString();

    if (submission) {
      const patch: TablesUpdate<"activity_submissions"> = {
        answers: answersParsed.data as unknown as Json,
        time_spent_seconds: timeSpent,
        status: "entregada",
        submitted_at: now,
        auto_score: autoScore,
      };
      const { error } = await supabase.from("activity_submissions").update(patch).eq("id", submission.id);
      if (error) throw new Error(`No se pudo registrar la entrega: ${error.message}`);
    } else {
      const { error } = await supabase.from("activity_submissions").insert({
        activity_id: input.activityId,
        student_id: auth.user.id,
        answers: answersParsed.data as unknown as Json,
        time_spent_seconds: timeSpent,
        status: "entregada",
        submitted_at: now,
        auto_score: autoScore,
      });
      if (error) throw new Error(`No se pudo registrar la entrega: ${error.message}`);
    }

    revalidatePath(STUDENT_BASE);
    revalidatePath(`${STUDENT_BASE}/${input.activityId}`);
    revalidatePath("/campus/estudiante");
    revalidatePath(`/campus/docente/actividades/${input.activityId}`);
    revalidatePath("/campus/docente/actividades");
    return { ok: true, data: { autoScore, correct, total } };
  } catch (err) {
    console.error("[actividades/estudiante] submitActivity", { activityId: input.activityId, err });
    return { ok: false, error: errorMessage(err, "No se pudo entregar la actividad.") };
  }
}
