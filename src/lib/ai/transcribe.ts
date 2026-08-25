/**
 * Transcripción de un chunk de audio (server-only).
 * Primario: endpoint Whisper-compatible de OpenRouter (verbose_json con segmentos).
 * Fallback: chat completions con un modelo multimodal y `input_audio` en base64.
 */
import { z } from "zod";
import { toFile } from "openai";
import { openrouter, MODELS, assertOpenRouterConfigured } from "@/lib/openrouter";
import { extractJson } from "@/lib/ai/json";
import { AUDIO_TRANSCRIBE_SYSTEM, audioTranscribeUserPrompt } from "@/lib/ai/prompts/transcribe";
import type { TranscriptSegment } from "@/lib/types/helpers";

export interface TranscribeOptions {
  language?: "es";
  /** Segundos a sumar a start/end (posición del chunk en la grabación). */
  offsetSeconds: number;
  /** Duración esperada del chunk (ayuda al fallback a acotar timestamps). */
  durationSeconds?: number | null;
  /** Forzar proveedor (tests / reintentos). */
  provider?: TranscribeProvider;
}

export type TranscribeProvider = "whisper" | "audio-chat";

export interface TranscribeResult {
  text: string;
  segments: TranscriptSegment[];
  /** Modelo efectivamente usado, p. ej. "openai/whisper-1" o "google/gemini-3.7-flash (fallback)". */
  model: string;
  provider: TranscribeProvider;
}

export class TranscribeError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranscribeError";
  }
}

/** Límite del endpoint Whisper de OpenAI/OpenRouter. */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Timeout por proveedor: el step route corre con maxDuration=300, así que
 * 110 s (Whisper) + 110 s (fallback multimodal) dejan margen para persistir
 * el resultado o el estado de error antes de que Vercel mate la función.
 */
const PROVIDER_TIMEOUT_MS = 110_000;

const segmentSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
});

const audioChatSchema = z.object({ segments: z.array(segmentSchema) });

const verboseSchema = z.object({
  text: z.string().optional().default(""),
  segments: z.array(segmentSchema).optional(),
  duration: z.number().optional(),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Normaliza: descarta vacíos, ordena, corrige solapamientos/inversiones y aplica offset. */
export function normalizeSegments(raw: TranscriptSegment[], offset: number, maxDuration?: number | null): TranscriptSegment[] {
  const cleaned = raw
    .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: (s.text ?? "").trim() }))
    .filter((s) => s.text.length > 0)
    .sort((a, b) => a.start - b.start);

  const out: TranscriptSegment[] = [];
  let cursor = 0;
  for (const s of cleaned) {
    let start = Math.max(s.start, cursor);
    let end = Math.max(s.end, start + 0.01);
    if (maxDuration && maxDuration > 0) {
      start = Math.min(start, maxDuration);
      end = Math.min(end, maxDuration);
      if (end <= start) end = start + 0.01;
    }
    cursor = end;
    out.push({ start: round2(start + offset), end: round2(end + offset), text: s.text });
  }
  return out;
}

function joinText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

async function toBuffer(input: Blob | Buffer | Uint8Array): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return Buffer.from(await input.arrayBuffer());
}

async function transcribeWithWhisper(buf: Buffer, opts: TranscribeOptions): Promise<TranscribeResult> {
  if (buf.byteLength > WHISPER_MAX_BYTES) {
    throw new TranscribeError(`El chunk pesa ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB y supera el límite de 25 MB de Whisper.`);
  }
  const file = await toFile(buf, "chunk.mp3", { type: "audio/mpeg" });
  const res = await openrouter.audio.transcriptions.create(
    {
      file,
      model: MODELS.transcription,
      response_format: "verbose_json",
      language: opts.language ?? "es",
      temperature: 0,
    },
    { timeout: PROVIDER_TIMEOUT_MS },
  );
  const parsed = verboseSchema.safeParse(res);
  if (!parsed.success) {
    throw new TranscribeError("Whisper devolvió una respuesta con formato inesperado.", parsed.error);
  }
  let segments: TranscriptSegment[];
  if (parsed.data.segments && parsed.data.segments.length > 0) {
    segments = normalizeSegments(parsed.data.segments, opts.offsetSeconds, opts.durationSeconds);
  } else {
    // Sin segmentos: un único bloque que cubre el chunk.
    const text = parsed.data.text.trim();
    const dur = parsed.data.duration ?? opts.durationSeconds ?? 0;
    segments = text ? [{ start: round2(opts.offsetSeconds), end: round2(opts.offsetSeconds + dur), text }] : [];
  }
  return { text: joinText(segments), segments, model: MODELS.transcription, provider: "whisper" };
}

async function transcribeWithAudioChat(buf: Buffer, opts: TranscribeOptions): Promise<TranscribeResult> {
  const base64 = buf.toString("base64");
  const res = await openrouter.chat.completions.create(
    {
      model: MODELS.audio,
      temperature: 0,
      messages: [
        { role: "system", content: AUDIO_TRANSCRIBE_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: audioTranscribeUserPrompt(opts.durationSeconds) },
            { type: "input_audio", input_audio: { data: base64, format: "mp3" } },
          ],
        },
      ],
    },
    { timeout: PROVIDER_TIMEOUT_MS },
  );
  const content = res.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new TranscribeError("El modelo de audio devolvió una respuesta vacía.");

  const parsed = audioChatSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new TranscribeError("El modelo de audio no devolvió el JSON de segmentos esperado.", parsed.error);
  }
  const segments = normalizeSegments(parsed.data.segments, opts.offsetSeconds, opts.durationSeconds);
  return {
    text: joinText(segments),
    segments,
    model: `${res.model ?? MODELS.audio} (fallback)`,
    provider: "audio-chat",
  };
}

function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { status?: number; message?: string };
    const status = typeof e.status === "number" ? `HTTP ${e.status}` : "";
    const msg = typeof e.message === "string" ? e.message : "";
    return [status, msg].filter(Boolean).join(" — ") || "error desconocido";
  }
  return String(err);
}

/**
 * Transcribe un chunk MP3. Intenta Whisper; ante cualquier fallo del proveedor
 * (404/400/unsupported/timeouts) cae automáticamente al modelo multimodal.
 */
export async function transcribeChunk(input: Blob | Buffer | Uint8Array, opts: TranscribeOptions): Promise<TranscribeResult> {
  assertOpenRouterConfigured();
  const buf = await toBuffer(input);
  if (buf.byteLength === 0) throw new TranscribeError("El chunk de audio está vacío.");

  if (opts.provider === "audio-chat") return transcribeWithAudioChat(buf, opts);

  try {
    return await transcribeWithWhisper(buf, opts);
  } catch (whisperErr) {
    if (opts.provider === "whisper") throw whisperErr;
    console.warn("[transcribe] Whisper falló, usando fallback multimodal", { reason: describeError(whisperErr) });
    try {
      return await transcribeWithAudioChat(buf, opts);
    } catch (fallbackErr) {
      console.error("[transcribe] fallback multimodal también falló", { reason: describeError(fallbackErr) });
      throw new TranscribeError(
        `No se pudo transcribir el chunk. Whisper: ${describeError(whisperErr)}. Fallback: ${describeError(fallbackErr)}.`,
        fallbackErr,
      );
    }
  }
}
