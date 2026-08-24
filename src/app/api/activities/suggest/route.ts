import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatJSON, LLMError } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import { errorMessage } from "@/lib/utils";
import { isTeacherOfCourse, getRecordingContext } from "@/components/activities/queries";
import { suggestRequestSchema, suggestionSchema, type SuggestResponse } from "@/components/activities/suggest-schema";
import { suggestSystemPrompt, suggestUserPrompt } from "@/components/activities/ai-prompts";

export const maxDuration = 120;

/**
 * POST /api/activities/suggest { recordingId, type }
 * Genera título, consigna y (cuestionario) 8 preguntas a partir de transcripción/resumen.
 * Sólo docentes del curso de la grabación. No persiste nada: el docente edita y guarda.
 */
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = suggestRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { recordingId, type } = parsed.data;

  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.role === "estudiante") {
    return NextResponse.json({ error: "Sólo el equipo docente puede generar actividades." }, { status: 403 });
  }

  const supabase = await createClient();
  const recording = await getRecordingContext(supabase, recordingId).catch(() => null);
  if (!recording) return NextResponse.json({ error: "La grabación no existe o no tenés acceso." }, { status: 404 });
  if (!(await isTeacherOfCourse(supabase, auth.user.id, auth.profile.role, recording.course_id))) {
    return NextResponse.json({ error: "No sos docente de este curso." }, { status: 403 });
  }

  const [summaryRes, transcriptRes] = await Promise.all([
    supabase.from("class_summaries").select("summary_md, key_points").eq("recording_id", recordingId).maybeSingle(),
    supabase.from("transcripts").select("full_text").eq("recording_id", recordingId).maybeSingle(),
  ]);
  if (summaryRes.error) console.error("[activities/suggest] summary", summaryRes.error);
  if (transcriptRes.error) console.error("[activities/suggest] transcript", transcriptRes.error);

  const summaryMd = summaryRes.data?.summary_md ?? null;
  const keyPoints = Array.isArray(summaryRes.data?.key_points)
    ? summaryRes.data.key_points.filter((k): k is string => typeof k === "string")
    : [];
  const transcript = transcriptRes.data?.full_text?.trim() || null;

  if (!summaryMd && !transcript) {
    return NextResponse.json(
      { error: "La grabación todavía no tiene transcripción ni resumen. Esperá a que termine el procesamiento." },
      { status: 422 },
    );
  }

  try {
    const result = await chatJSON({
      schema: suggestionSchema,
      system: suggestSystemPrompt(type),
      user: suggestUserPrompt({
        classTopic: recording.class_topic,
        recordingTitle: recording.title,
        summaryMd,
        keyPoints,
        transcript,
      }),
      model: MODELS.reasoning,
      temperature: 0.5,
      maxTokens: 6000,
    });

    if (type === "cuestionario" && result.data.questions.length < 4) {
      return NextResponse.json({ error: "La IA devolvió muy pocas preguntas. Probá de nuevo." }, { status: 502 });
    }

    const payload: SuggestResponse = {
      suggestion: result.data,
      model: result.model,
      source: { transcript: Boolean(transcript), summary: Boolean(summaryMd) },
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[activities/suggest] error", { recordingId, type, err });
    const message = err instanceof LLMError ? err.message : errorMessage(err, "No se pudo generar la sugerencia.");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
