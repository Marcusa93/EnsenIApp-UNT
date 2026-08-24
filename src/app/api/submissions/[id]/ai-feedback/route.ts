import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatText, LLMError } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import { errorMessage } from "@/lib/utils";
import { isTeacherOfCourse } from "@/components/activities/queries";
import { FEEDBACK_SYSTEM_PROMPT, feedbackUserPrompt } from "@/components/activities/ai-prompts";
import { isEditableType } from "@/components/activities/model";

export const maxDuration = 120;

const paramsSchema = z.object({ id: z.uuid() });

/**
 * POST /api/submissions/[id]/ai-feedback
 * Genera feedback sugerido (markdown) para una entrega, lo guarda en ai_feedback_md
 * y lo devuelve para que el docente lo edite antes de publicarlo como teacher_feedback_md.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const submissionId = parsed.data.id;

  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.role === "estudiante") {
    return NextResponse.json({ error: "Sólo el equipo docente puede pedir feedback sugerido." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: submission, error } = await supabase
    .from("activity_submissions")
    .select("*, activity:activities(*)")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) {
    console.error("[submissions/ai-feedback] lectura", { submissionId, error });
    return NextResponse.json({ error: "No se pudo leer la entrega." }, { status: 500 });
  }
  if (!submission) return NextResponse.json({ error: "La entrega no existe o no tenés acceso." }, { status: 404 });
  const activity = Array.isArray(submission.activity) ? submission.activity[0] : submission.activity;
  if (!activity) return NextResponse.json({ error: "La actividad de esta entrega no existe." }, { status: 404 });
  if (!(await isTeacherOfCourse(supabase, auth.user.id, auth.profile.role, activity.course_id))) {
    return NextResponse.json({ error: "No sos docente de este curso." }, { status: 403 });
  }
  if (!isEditableType(activity.type)) {
    return NextResponse.json({ error: "Este tipo de actividad no admite feedback automático." }, { status: 422 });
  }

  try {
    const result = await chatText({
      system: FEEDBACK_SYSTEM_PROMPT,
      user: feedbackUserPrompt(activity, submission),
      model: MODELS.reasoning,
      temperature: 0.4,
      maxTokens: 1500,
    });
    const feedback = result.data.trim();

    const { error: saveErr } = await supabase
      .from("activity_submissions")
      .update({ ai_feedback_md: feedback })
      .eq("id", submissionId);
    if (saveErr) console.error("[submissions/ai-feedback] no se pudo guardar ai_feedback_md", { submissionId, saveErr });

    return NextResponse.json({ feedback_md: feedback, model: result.model, usage: result.usage, saved: !saveErr });
  } catch (err) {
    console.error("[submissions/ai-feedback] error", { submissionId, err });
    const message = err instanceof LLMError ? err.message : errorMessage(err, "No se pudo generar el feedback.");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
