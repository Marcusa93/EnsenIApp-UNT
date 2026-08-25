import OpenAI from "openai";

/**
 * Timeout por defecto de cada request a OpenRouter. El default del SDK (600 s + 2 retries)
 * supera cualquier maxDuration de Vercel: un proveedor colgado consumiría el budget completo
 * de la función y anularía fallbacks y escritura de estados de error. 100 s deja margen en
 * las rutas de 120 s; las llamadas con más presupuesto lo suben por request (`{ timeout }`).
 */
export const OPENROUTER_DEFAULT_TIMEOUT_MS = 100_000;

/** OpenRouter es OpenAI-compatible: chat/completions y audio/transcriptions. Sólo server-side. */
export const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "missing-key",
  baseURL: "https://openrouter.ai/api/v1",
  timeout: OPENROUTER_DEFAULT_TIMEOUT_MS,
  // Los reintentos los maneja la app (pipeline por pasos, chatJSON): acá duplicarían el budget.
  maxRetries: 0,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://ensenia-unt.vercel.app",
    "X-Title": "EnsenIA UNT",
  },
});

export const MODELS = {
  /** Transcripción vía endpoint Whisper-compatible de OpenRouter */
  transcription: process.env.OPENROUTER_MODEL_TRANSCRIPTION ?? "openai/whisper-1",
  /** Fallback: modelo multimodal con entrada de audio (chat completions + input_audio) */
  audio: process.env.OPENROUTER_MODEL_AUDIO ?? "google/gemini-3.7-flash",
  /** Generación de calidad: resúmenes, placas, informes, síntesis de debate */
  reasoning: process.env.OPENROUTER_MODEL_REASONING ?? "anthropic/claude-sonnet-5",
  /** Tareas rápidas/baratas: simplificación, respuestas a consultas, feedback corto */
  fast: process.env.OPENROUTER_MODEL_FAST ?? "anthropic/claude-haiku-4.5",
} as const;

export function assertOpenRouterConfigured() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY no configurada. Agregala en .env.local / Vercel.");
  }
}
