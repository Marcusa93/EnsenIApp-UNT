import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatText, LLMError } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import { parseKeyPoints, parseSegments } from "@/components/class-content/parse";
import type { TranscriptSegment } from "@/lib/types/helpers";
import { errorMessage } from "@/lib/utils";

export const maxDuration = 120;

const paramsSchema = z.object({ questionId: z.uuid() });

const MAX_SUMMARY_CHARS = 6000;
const MAX_SEGMENTS = 14;
const MAX_SEGMENT_CHARS = 700;

const SYSTEM_PROMPT = `Sos el asistente pedagógico del campus de la materia "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI" (Abogacía, Universidad Nacional de Tucumán).
Respondés consultas de estudiantes en español rioplatense (voseo), con tono cercano, claro y riguroso.

Reglas:
- Basate PRIMERO en el material de la clase que te paso (resumen y fragmentos de la transcripción). Si un fragmento cubre la duda, citalo explícitamente indicando el minuto (p. ej. "En la clase, alrededor del minuto 23, el docente explica…").
- Si la consulta excede lo visto en clase o el material no alcanza, decilo con honestidad, respondé lo que puedas con criterio jurídico general y sugerí que el estudiante se lo pregunte al equipo docente (la consulta les llega igual).
- No inventes citas de la clase, normas ni fallos. Si no estás seguro de una norma, señalalo.
- Estructura en Markdown: una respuesta directa en 1–2 párrafos, luego "**Dónde lo vimos en clase**" (si aplica) y, si sirve, "**Para seguir**" con 1–3 sugerencias concretas (repasar placas, releer una sección, preguntar al docente).
- Extensión: entre 120 y 350 palabras. Sin encabezados de nivel 1.`;

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 3);
}

/** Fragmentos de la transcripción más relacionados con la consulta (solapamiento léxico simple). */
function relevantSegments(segments: TranscriptSegment[], question: string): TranscriptSegment[] {
  const qWords = new Set(tokenize(question));
  if (qWords.size === 0 || segments.length === 0) return segments.slice(0, MAX_SEGMENTS);
  const scored = segments.map((seg, i) => {
    const words = tokenize(seg.text);
    let score = 0;
    for (const w of words) if (qWords.has(w)) score++;
    return { seg, i, score: words.length ? score / Math.sqrt(words.length) : 0 };
  });
  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SEGMENTS)
    .sort((a, b) => a.i - b.i);
  return (top.length > 0 ? top : scored.slice(0, MAX_SEGMENTS)).map((s) => s.seg);
}

/**
 * POST /api/questions/[questionId]/answer
 * Responde con IA una consulta propia del estudiante usando el material de la clase/grabación referida.
 * Idempotente: si ya tiene respuesta IA o del docente, la devuelve sin volver a generar.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ questionId: string }> }) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const { questionId } = parsed.data;

  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });

  // Lectura con RLS: sólo ve la consulta si es suya (o pública / docente); exigimos que sea propia.
  const supabase = await createClient();
  const { data: question, error } = await supabase
    .from("student_questions")
    .select("id, student_id, course_id, class_id, recording_id, question, ai_answer_md, teacher_answer_md, status")
    .eq("id", questionId)
    .maybeSingle();
  if (error) {
    console.error("[questions/answer] lectura", { questionId, error });
    return NextResponse.json({ error: "No se pudo leer la consulta." }, { status: 500 });
  }
  if (!question || question.student_id !== auth.user.id) {
    return NextResponse.json({ error: "La consulta no existe o no es tuya." }, { status: 404 });
  }
  if (question.ai_answer_md) {
    return NextResponse.json({ answer_md: question.ai_answer_md, cached: true });
  }
  if (question.status === "respondida_docente" || question.status === "cerrada") {
    return NextResponse.json(
      { error: "Esta consulta ya fue respondida por el equipo docente.", answer_md: question.teacher_answer_md ?? null },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  // --- Contexto: materia + clase + grabación (resumen y transcripción) ---
  const [courseRes, classRes] = await Promise.all([
    admin
      .from("courses")
      .select("name, subject:subjects(name, description)")
      .eq("id", question.course_id)
      .maybeSingle(),
    question.class_id
      ? admin.from("classes").select("id, topic, summary, class_date").eq("id", question.class_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (courseRes.error) console.error("[questions/answer] course", courseRes.error);
  if (classRes.error) console.error("[questions/answer] class", classRes.error);

  const subjectRaw = courseRes.data?.subject;
  const subject = Array.isArray(subjectRaw) ? (subjectRaw[0] ?? null) : (subjectRaw ?? null);
  const cls = classRes.data;

  // Grabación de referencia: la indicada, o la última publicada de la clase.
  let recordingId = question.recording_id;
  if (!recordingId && question.class_id) {
    const { data: rec, error: recErr } = await admin
      .from("class_recordings")
      .select("id")
      .eq("class_id", question.class_id)
      .eq("published", true)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recErr) console.error("[questions/answer] recording lookup", recErr);
    recordingId = rec?.id ?? null;
  }

  let summaryBlock = "";
  let transcriptBlock = "";
  if (recordingId) {
    const [sumRes, trRes] = await Promise.all([
      admin
        .from("class_summaries")
        .select("summary_md, key_points, created_at")
        .eq("recording_id", recordingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("transcripts").select("segments, full_text").eq("recording_id", recordingId).maybeSingle(),
    ]);
    if (sumRes.error) console.error("[questions/answer] summary", sumRes.error);
    if (trRes.error) console.error("[questions/answer] transcript", trRes.error);

    if (sumRes.data) {
      const keyPoints = parseKeyPoints(sumRes.data.key_points);
      summaryBlock = `${sumRes.data.summary_md.slice(0, MAX_SUMMARY_CHARS)}${
        keyPoints.length ? `\n\nPuntos clave:\n${keyPoints.map((k) => `- ${k}`).join("\n")}` : ""
      }`;
    }
    if (trRes.data) {
      const segments = parseSegments(trRes.data.segments);
      if (segments.length > 0) {
        transcriptBlock = relevantSegments(segments, question.question)
          .map((s) => `[${formatTimestamp(s.start)}] ${s.text.slice(0, MAX_SEGMENT_CHARS)}`)
          .join("\n");
      } else if (trRes.data.full_text) {
        transcriptBlock = trRes.data.full_text.slice(0, 8000);
      }
    }
  }

  const userPrompt = [
    `MATERIA: ${subject?.name ?? "Derecho de las Nuevas Tecnologías y Bioderecho"}${courseRes.data?.name ? ` — ${courseRes.data.name}` : ""}`,
    subject?.description ? `Descripción de la materia: ${subject.description}` : null,
    cls ? `CLASE REFERIDA: "${cls.topic}" (${cls.class_date})${cls.summary ? `\nDescripción: ${cls.summary}` : ""}` : "CLASE REFERIDA: ninguna (consulta general).",
    summaryBlock ? `\nRESUMEN DE LA CLASE (generado a partir de la grabación):\n${summaryBlock}` : "\nRESUMEN DE LA CLASE: no disponible.",
    transcriptBlock
      ? `\nFRAGMENTOS DE LA TRANSCRIPCIÓN (con minuto):\n${transcriptBlock}`
      : "\nTRANSCRIPCIÓN: no disponible (no cites minutos de la clase).",
    `\nCONSULTA DEL ESTUDIANTE:\n${question.question.trim()}`,
  ]
    .filter((p): p is string => Boolean(p))
    .join("\n");

  try {
    const result = await chatText({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      model: MODELS.fast,
      temperature: 0.4,
      maxTokens: 1100,
    });
    const answerMd = result.data.trim();

    // Sólo se actualiza si sigue abierta: no pisar una respuesta docente que llegó mientras tanto.
    const { data: updated, error: updErr } = await admin
      .from("student_questions")
      .update({ ai_answer_md: answerMd, status: "respondida_ia" })
      .eq("id", questionId)
      .eq("status", "abierta")
      .select("id")
      .maybeSingle();
    if (updErr) {
      console.error("[questions/answer] no se pudo guardar la respuesta", { questionId, updErr });
      return NextResponse.json({ error: "Se generó la respuesta pero no se pudo guardar." }, { status: 500 });
    }
    if (!updated) {
      // Cambió de estado en el medio (docente respondió): guardamos la IA sin tocar el estado.
      await admin.from("student_questions").update({ ai_answer_md: answerMd }).eq("id", questionId);
    }

    return NextResponse.json({ answer_md: answerMd, model: result.model, usage: result.usage });
  } catch (err) {
    const message =
      err instanceof LLMError ? err.message : errorMessage(err, "No pudimos generar la respuesta. Probá de nuevo en unos segundos.");
    console.error("[questions/answer] error", { questionId, err });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
