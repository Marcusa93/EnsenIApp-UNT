import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openrouter, MODELS } from "@/lib/openrouter";

export async function POST(request: Request) {
  const { recordingId } = await request.json();
  if (!recordingId) {
    return NextResponse.json({ error: "recordingId requerido" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: recording } = await supabase
    .from("class_recordings")
    .select("*")
    .eq("id", recordingId)
    .single();

  if (!recording) {
    return NextResponse.json({ error: "Grabación no encontrada" }, { status: 404 });
  }

  try {
    await supabase
      .from("class_recordings")
      .update({ status: "transcribing" })
      .eq("id", recordingId);

    const { data: file } = await supabase.storage
      .from("class-recordings")
      .download(recording.storage_path);
    if (!file) throw new Error("No se pudo descargar el audio");

    const transcription = await openrouter.audio.transcriptions.create({
      file: new File([file], "clase.mp3", { type: file.type || "audio/mpeg" }),
      model: MODELS.transcription,
      response_format: "verbose_json",
      language: "es",
    });

    const fullText = transcription.text;
    const segments =
      "segments" in transcription
        ? // @ts-expect-error verbose_json segments aren't in the OpenAI SDK's narrow type
          transcription.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text })) ?? []
        : [];

    await supabase.from("transcripts").insert({
      recording_id: recordingId,
      full_text: fullText,
      segments,
      model: MODELS.transcription,
    });

    await supabase
      .from("class_recordings")
      .update({ status: "processing" })
      .eq("id", recordingId);

    const [summaryRes, cardsRes, simpleRes, feedbackRes] = await Promise.all([
      generateSummary(fullText),
      generateCards(fullText),
      generateSimplified(fullText),
      generateFeedback(fullText),
    ]);

    await Promise.all([
      supabase.from("class_summaries").insert({
        recording_id: recordingId,
        summary_md: summaryRes.summary,
        key_points: summaryRes.keyPoints,
        model: MODELS.reasoning,
      }),
      supabase.from("interactive_cards").insert({
        recording_id: recordingId,
        cards: cardsRes,
        model: MODELS.reasoning,
      }),
      supabase.from("simplified_content").insert({
        recording_id: recordingId,
        level: "facil",
        content_md: simpleRes,
        model: MODELS.fast,
      }),
      supabase.from("ai_feedback").insert({
        student_id: recording.uploaded_by,
        recording_id: recordingId,
        feedback_md: feedbackRes,
        model: MODELS.reasoning,
      }),
    ]);

    await supabase
      .from("class_recordings")
      .update({ status: "ready" })
      .eq("id", recordingId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    await supabase
      .from("class_recordings")
      .update({ status: "error", error_message: (err as Error).message })
      .eq("id", recordingId);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function chat(prompt: string, system: string, model: string) {
  const res = await openrouter.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

async function generateSummary(transcript: string) {
  const content = await chat(
    transcript,
    "Sos un asistente docente de Derecho de las Nuevas Tecnologías y Bioderecho. Generá un resumen claro en español (máx 200 palabras) y 4 a 6 puntos clave de la clase, en JSON: {\"summary\": string, \"keyPoints\": string[]}.",
    MODELS.reasoning,
  );
  try {
    return JSON.parse(content);
  } catch {
    return { summary: content, keyPoints: [] };
  }
}

async function generateCards(transcript: string) {
  const content = await chat(
    transcript,
    'Generá 6 tarjetas de estudio (flashcards) sobre los conceptos jurídicos más importantes de esta clase, en JSON: [{"question": string, "answer": string, "type": "flashcard"}].',
    MODELS.reasoning,
  );
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function generateSimplified(transcript: string) {
  return chat(
    transcript,
    "Reescribí el contenido de esta clase en lenguaje simple y accesible, sin jerga jurídica innecesaria, para un estudiante que recién empieza. Máximo 300 palabras, en Markdown.",
    MODELS.fast,
  );
}

async function generateFeedback(transcript: string) {
  return chat(
    transcript,
    "A partir de esta clase, redactá una devolución breve (3-4 líneas) orientadora para el alumno sobre qué reforzar y cómo seguir estudiando el tema.",
    MODELS.reasoning,
  );
}
