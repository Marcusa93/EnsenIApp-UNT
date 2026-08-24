import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/types/database";
import type { ClassRecording, TranscriptSegment } from "@/lib/types/helpers";
import { transcribeChunk } from "@/lib/ai/transcribe";
import { condenseTranscript, generateCards, generateSimplified, generateSummary, type CondensedTranscript } from "@/lib/ai/generate";
import { parseSegments } from "@/components/class-content/parse";
import {
  GENERATION_STEPS,
  PROGRESS,
  isGenerationStep,
  type GenerationStep,
  type ProcessingLogEntry,
  type StepResponse,
} from "@/lib/audio/pipeline";
import { errorMessage } from "@/lib/utils";

export const maxDuration = 300;

const BUCKET = "class-recordings";
const paramsSchema = z.object({ recordingId: z.uuid() });

type Admin = SupabaseClient<Database>;

class StepError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly httpStatus = 500,
  ) {
    super(message);
    this.name = "StepError";
  }
}

function toResponse(r: ClassRecording, done: boolean, error?: string): StepResponse {
  return {
    status: r.status,
    progress: r.progress,
    current_step: r.current_step,
    chunks_done: r.chunks_done,
    chunks_total: r.chunks_total,
    done,
    ...(error ? { error } : {}),
  };
}

function readLog(json: Json): ProcessingLogEntry[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((e) => {
    if (!e || typeof e !== "object" || Array.isArray(e)) return [];
    const o = e as Record<string, unknown>;
    if (typeof o.message !== "string") return [];
    return [{ at: String(o.at ?? ""), step: String(o.step ?? ""), message: o.message }];
  });
}

function appendLog(current: Json, step: string, message: string): ProcessingLogEntry[] {
  const entries = readLog(current);
  entries.push({ at: new Date().toISOString(), step, message });
  // Conservamos las últimas 60 entradas.
  return entries.slice(-60);
}

/** Actualiza la fila y devuelve el estado nuevo. */
async function patch(admin: Admin, id: string, values: Database["public"]["Tables"]["class_recordings"]["Update"]) {
  const { data, error } = await admin.from("class_recordings").update(values).eq("id", id).select("*").single();
  if (error || !data) throw new StepError(`No se pudo actualizar la grabación: ${error?.message ?? "sin datos"}`, "db");
  return data;
}

// ---------------------------------------------------------------------------
// Paso: transcribir un chunk
// ---------------------------------------------------------------------------
async function stepTranscribe(admin: Admin, rec: ClassRecording): Promise<{ rec: ClassRecording; done: boolean }> {
  const { data: chunks, error } = await admin
    .from("recording_chunks")
    .select("id, chunk_index, storage_path, start_seconds, duration_seconds, transcribed")
    .eq("recording_id", rec.id)
    .order("chunk_index", { ascending: true });
  if (error) throw new StepError(`No se pudieron leer los chunks: ${error.message}`, "transcribe");

  const total = chunks.length;
  if (total === 0) {
    throw new StepError("La grabación no tiene audio subido. Eliminala y volvé a subir el archivo.", "transcribe", 422);
  }
  if (rec.chunks_total > 0 && total < rec.chunks_total) {
    throw new StepError(
      `La subida quedó incompleta (${total} de ${rec.chunks_total} partes). Eliminá la grabación y volvé a subirla.`,
      "transcribe",
      422,
    );
  }

  const next = chunks.find((c) => !c.transcribed);
  const doneCount = chunks.filter((c) => c.transcribed).length;

  if (!next) {
    const updated = await patch(admin, rec.id, {
      status: "processing",
      progress: PROGRESS.processing,
      current_step: "compile",
      chunks_done: doneCount,
      chunks_total: total,
      error_message: null,
      processing_log: appendLog(rec.processing_log, "transcribe", `Transcripción completa (${total} partes).`) as unknown as Json,
    });
    return { rec: updated, done: false };
  }

  // Marcamos el inicio del paso (visible por Realtime).
  if (rec.status !== "transcribing" || rec.current_step !== `chunk-${next.chunk_index}`) {
    rec = await patch(admin, rec.id, {
      status: "transcribing",
      current_step: `chunk-${next.chunk_index}`,
      chunks_total: total,
      chunks_done: doneCount,
      progress: Math.max(rec.progress, PROGRESS.transcribingFrom),
      error_message: null,
    });
  }

  const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(next.storage_path);
  if (dlErr || !file) {
    throw new StepError(`No se pudo descargar la parte ${next.chunk_index + 1} del audio: ${dlErr?.message ?? "sin datos"}`, "transcribe");
  }

  const result = await transcribeChunk(file, {
    language: "es",
    offsetSeconds: Number(next.start_seconds) || 0,
    durationSeconds: next.duration_seconds,
  });

  const { error: upErr } = await admin
    .from("recording_chunks")
    .update({
      transcribed: true,
      text: result.text,
      segments: result.segments as unknown as Json,
      error_message: null,
    })
    .eq("id", next.id);
  if (upErr) throw new StepError(`No se pudo guardar la transcripción de la parte ${next.chunk_index + 1}: ${upErr.message}`, "transcribe");

  const newDone = doneCount + 1;
  const progress = Math.round(PROGRESS.transcribingFrom + (PROGRESS.transcribingTo - PROGRESS.transcribingFrom) * (newDone / total));
  const model = rec.transcription_model && rec.transcription_model !== result.model
    ? `${rec.transcription_model} + ${result.model}`
    : result.model;

  const updated = await patch(admin, rec.id, {
    status: "transcribing",
    chunks_done: newDone,
    chunks_total: total,
    progress,
    current_step: newDone < total ? `chunk-${next.chunk_index + 1}` : "compile",
    transcription_model: model,
    error_message: null,
    processing_log: appendLog(
      rec.processing_log,
      "transcribe",
      `Parte ${next.chunk_index + 1}/${total} transcripta con ${result.model} (${result.segments.length} segmentos).`,
    ) as unknown as Json,
  });
  return { rec: updated, done: false };
}

// ---------------------------------------------------------------------------
// Paso: compilar la transcripción completa
// ---------------------------------------------------------------------------
async function stepCompile(admin: Admin, rec: ClassRecording): Promise<{ rec: ClassRecording; done: boolean }> {
  const { data: chunks, error } = await admin
    .from("recording_chunks")
    .select("chunk_index, text, segments, transcribed, start_seconds")
    .eq("recording_id", rec.id)
    .order("chunk_index", { ascending: true });
  if (error) throw new StepError(`No se pudieron leer los chunks: ${error.message}`, "compile");

  const pending = chunks.filter((c) => !c.transcribed);
  if (pending.length > 0) {
    // Inconsistencia (p. ej. reproceso parcial): volvemos a transcribir.
    const updated = await patch(admin, rec.id, { status: "transcribing", current_step: null });
    return { rec: updated, done: false };
  }

  const segments: TranscriptSegment[] = chunks.flatMap((c) => parseSegments(c.segments)).sort((a, b) => a.start - b.start);
  const fullText = segments.length > 0
    ? segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim()
    : chunks.map((c) => (c.text ?? "").trim()).filter(Boolean).join(" ");

  if (!fullText) {
    throw new StepError("La transcripción quedó vacía: no se detectó voz en el audio.", "compile", 422);
  }

  const { error: upsertErr } = await admin
    .from("transcripts")
    .upsert(
      {
        recording_id: rec.id,
        full_text: fullText,
        segments: segments as unknown as Json,
        language: "es",
        model: rec.transcription_model,
      },
      { onConflict: "recording_id" },
    );
  if (upsertErr) throw new StepError(`No se pudo guardar la transcripción: ${upsertErr.message}`, "compile");

  const updated = await patch(admin, rec.id, {
    status: "generating",
    current_step: GENERATION_STEPS[0],
    progress: PROGRESS.generating.summary,
    error_message: null,
    processing_log: appendLog(
      rec.processing_log,
      "compile",
      `Transcripción consolidada: ${fullText.length.toLocaleString("es-AR")} caracteres, ${segments.length} segmentos.`,
    ) as unknown as Json,
  });
  return { rec: updated, done: false };
}

// ---------------------------------------------------------------------------
// Paso: generación (un sub-paso por request)
// ---------------------------------------------------------------------------
interface Existing {
  summary: { summary_md: string; key_points: Json } | null;
  cards: boolean;
  facil: boolean;
  intermedio: boolean;
}

async function loadExisting(admin: Admin, recordingId: string): Promise<Existing> {
  const [summary, cards, simplified] = await Promise.all([
    admin.from("class_summaries").select("summary_md, key_points").eq("recording_id", recordingId).limit(1).maybeSingle(),
    admin.from("interactive_cards").select("id").eq("recording_id", recordingId).limit(1).maybeSingle(),
    admin.from("simplified_content").select("level").eq("recording_id", recordingId),
  ]);
  for (const r of [summary, cards, simplified]) {
    if (r.error) throw new StepError(`No se pudo leer el material generado: ${r.error.message}`, "generate");
  }
  const levels = new Set((simplified.data ?? []).map((s) => s.level));
  return {
    summary: summary.data ?? null,
    cards: Boolean(cards.data),
    facil: levels.has("facil"),
    intermedio: levels.has("intermedio"),
  };
}

function isStepDone(step: GenerationStep, ex: Existing): boolean {
  switch (step) {
    case "summary":
      return ex.summary !== null;
    case "cards":
      return ex.cards;
    case "simplified_facil":
      return ex.facil;
    case "simplified_intermedio":
      return ex.intermedio;
  }
}

function keyPointsFrom(json: Json): string[] {
  return Array.isArray(json) ? json.filter((k): k is string => typeof k === "string") : [];
}

async function stepGenerate(admin: Admin, rec: ClassRecording): Promise<{ rec: ClassRecording; done: boolean }> {
  const existing = await loadExisting(admin, rec.id);

  // Primer sub-paso pendiente a partir del guardado (idempotente).
  const startIdx = isGenerationStep(rec.current_step) ? GENERATION_STEPS.indexOf(rec.current_step) : 0;
  const step = GENERATION_STEPS.slice(startIdx).find((s) => !isStepDone(s, existing)) ?? GENERATION_STEPS.find((s) => !isStepDone(s, existing));

  if (!step) {
    const updated = await patch(admin, rec.id, {
      status: "ready",
      progress: PROGRESS.ready,
      current_step: null,
      error_message: null,
      processing_log: appendLog(rec.processing_log, "generate", "Material de estudio completo. Grabación lista para revisar y publicar.") as unknown as Json,
    });
    return { rec: updated, done: true };
  }

  if (rec.current_step !== step || rec.status !== "generating") {
    rec = await patch(admin, rec.id, { status: "generating", current_step: step, progress: PROGRESS.generating[step], error_message: null });
  }

  const { data: transcript, error: tErr } = await admin
    .from("transcripts")
    .select("full_text")
    .eq("recording_id", rec.id)
    .maybeSingle();
  if (tErr) throw new StepError(`No se pudo leer la transcripción: ${tErr.message}`, step);
  if (!transcript) {
    const updated = await patch(admin, rec.id, { status: "processing", current_step: "compile", progress: PROGRESS.processing });
    return { rec: updated, done: false };
  }

  const condensed: CondensedTranscript = await condenseTranscript(transcript.full_text);
  const ctx = { condensed, title: rec.title };
  let model = "";
  let detail = "";

  if (step === "summary") {
    const res = await generateSummary(transcript.full_text, ctx);
    await admin.from("class_summaries").delete().eq("recording_id", rec.id);
    const { error } = await admin.from("class_summaries").insert({
      recording_id: rec.id,
      summary_md: res.data.summary_md,
      key_points: res.data.key_points as unknown as Json,
      sections: res.data.sections as unknown as Json,
      glossary: res.data.glossary as unknown as Json,
      model: res.model,
    });
    if (error) throw new StepError(`No se pudo guardar el resumen: ${error.message}`, step);
    model = res.model;
    detail = `${res.data.key_points.length} ideas clave, ${res.data.sections.length} secciones, ${res.data.glossary.length} términos`;
  } else if (step === "cards") {
    const summary = existing.summary
      ? { summary_md: existing.summary.summary_md, key_points: keyPointsFrom(existing.summary.key_points) }
      : { summary_md: "", key_points: [] };
    const res = await generateCards(transcript.full_text, summary, ctx);
    await admin.from("interactive_cards").delete().eq("recording_id", rec.id);
    const { error } = await admin
      .from("interactive_cards")
      .insert({ recording_id: rec.id, cards: res.data as unknown as Json, model: res.model });
    if (error) throw new StepError(`No se pudieron guardar las placas: ${error.message}`, step);
    model = res.model;
    detail = `${res.data.length} placas`;
  } else {
    const level = step === "simplified_facil" ? "facil" : "intermedio";
    const res = await generateSimplified(transcript.full_text, level, { ...ctx, summaryMd: existing.summary?.summary_md ?? null });
    const { error } = await admin
      .from("simplified_content")
      .upsert({ recording_id: rec.id, level, content_md: res.data, model: res.model }, { onConflict: "recording_id,level" });
    if (error) throw new StepError(`No se pudo guardar la versión simple (${level}): ${error.message}`, step);
    model = res.model;
    detail = `${res.data.split(/\s+/).length} palabras`;
  }

  const idx = GENERATION_STEPS.indexOf(step);
  const nextStep = GENERATION_STEPS[idx + 1];
  const isLast = !nextStep;
  const generationModel = rec.generation_model && !rec.generation_model.includes(model)
    ? `${rec.generation_model} + ${model}`
    : rec.generation_model ?? model;

  const updated = await patch(admin, rec.id, {
    status: isLast ? "ready" : "generating",
    current_step: isLast ? null : nextStep,
    progress: isLast ? PROGRESS.ready : PROGRESS.generating[nextStep],
    generation_model: generationModel,
    error_message: null,
    processing_log: appendLog(
      rec.processing_log,
      step,
      `${step} generado con ${model} (${detail}).${isLast ? " Grabación lista para revisar y publicar." : ""}`,
    ) as unknown as Json,
  });
  return { rec: updated, done: isLast };
}

// ---------------------------------------------------------------------------
// Dispatcher: decide el paso a partir del estado guardado (reanudable tras error)
// ---------------------------------------------------------------------------
async function runOneStep(admin: Admin, rec: ClassRecording): Promise<{ rec: ClassRecording; done: boolean }> {
  switch (rec.status) {
    case "ready":
      return { rec, done: true };
    case "uploaded":
    case "transcribing":
      return stepTranscribe(admin, rec);
    case "processing":
      return stepCompile(admin, rec);
    case "generating":
      return stepGenerate(admin, rec);
    case "error": {
      // Reanudar desde donde falló: inferimos la fase por lo que ya existe.
      if (isGenerationStep(rec.current_step) || rec.current_step === null) {
        const { data: t } = await admin.from("transcripts").select("id").eq("recording_id", rec.id).maybeSingle();
        if (t) return stepGenerate(admin, { ...rec, status: "generating" });
      }
      if (rec.current_step === "compile") return stepCompile(admin, { ...rec, status: "processing" });
      return stepTranscribe(admin, { ...rec, status: "transcribing" });
    }
  }
}

/**
 * POST /api/recordings/[recordingId]/step
 * Avanza UN paso del pipeline y responde { status, progress, current_step, chunks_done, chunks_total, done, error? }.
 * Idempotente: repetir un paso ya hecho no duplica datos. Tras un error, el siguiente POST reintenta desde el paso fallido.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ recordingId: string }> }) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const { recordingId } = parsed.data;

  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.role === "estudiante") {
    return NextResponse.json({ error: "Sólo el equipo docente puede procesar grabaciones." }, { status: 403 });
  }

  // Lectura con RLS: el docente sólo ve grabaciones de sus cursos.
  const supabase = await createClient();
  const { data: visible, error: readErr } = await supabase
    .from("class_recordings")
    .select("id, class:classes!inner(course_id)")
    .eq("id", recordingId)
    .maybeSingle();
  if (readErr) {
    console.error("[recordings/step] lectura", { recordingId, readErr });
    return NextResponse.json({ error: "No se pudo leer la grabación." }, { status: 500 });
  }
  if (!visible) return NextResponse.json({ error: "La grabación no existe o no tenés acceso." }, { status: 404 });

  if (auth.profile.role !== "admin") {
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("course_id")
      .eq("teacher_id", auth.user.id)
      .eq("course_id", visible.class.course_id)
      .maybeSingle();
    if (!assignment) return NextResponse.json({ error: "No sos docente de este curso." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: rec, error: recErr } = await admin.from("class_recordings").select("*").eq("id", recordingId).single();
  if (recErr || !rec) {
    console.error("[recordings/step] no se pudo cargar la fila", { recordingId, recErr });
    return NextResponse.json({ error: "No se pudo cargar la grabación." }, { status: 500 });
  }

  try {
    const { rec: updated, done } = await runOneStep(admin, rec);
    return NextResponse.json(toResponse(updated, done));
  } catch (err) {
    const step = err instanceof StepError ? err.step : rec.current_step ?? rec.status;
    const httpStatus = err instanceof StepError ? err.httpStatus : 500;
    const message = errorMessage(err, "Falló el procesamiento. Reintentá en unos minutos.");
    console.error("[recordings/step] error", { recordingId, step, status: rec.status, err });

    const { data: failed } = await admin
      .from("class_recordings")
      .update({
        status: "error",
        error_message: message,
        processing_log: appendLog(rec.processing_log, step, `Error: ${message}`) as unknown as Json,
      })
      .eq("id", recordingId)
      .select("*")
      .single();

    const body = failed ? toResponse(failed, false, message) : { ...toResponse(rec, false, message), status: "error" as const };
    return NextResponse.json(body, { status: httpStatus });
  }
}
