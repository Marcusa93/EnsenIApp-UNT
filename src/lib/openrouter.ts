import OpenAI from "openai";

/** OpenRouter is OpenAI-compatible; used for chat/completions and Whisper transcription. */
export const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://ensenia-unt.vercel.app",
    "X-Title": "EnsenIA UNT",
  },
});

export const MODELS = {
  transcription: "openai/whisper-1",
  reasoning: "anthropic/claude-sonnet-5",
  fast: "anthropic/claude-haiku-4.5",
} as const;
