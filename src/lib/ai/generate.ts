/**
 * Generación de material de estudio a partir de una transcripción (server-only).
 * Todo con salida JSON validada por zod vía chatJSON. Para transcripciones largas
 * se hace map-reduce: notas por tramo → consolidación.
 */
import { z } from "zod";
import { chatJSON, type ChatResult } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import { CHUNK_NOTES_SYSTEM } from "@/lib/ai/prompts/context";
import { SUMMARY_SYSTEM, summaryUserPrompt } from "@/lib/ai/prompts/summary";
import { CARDS_SYSTEM, cardsUserPrompt } from "@/lib/ai/prompts/cards";
import { simplifiedSystem, simplifiedUserPrompt, type SimplifiedLevel } from "@/lib/ai/prompts/simplified";
import type { GlossaryTerm, InteractiveCardItem, SummarySection } from "@/lib/types/helpers";

/** Umbral a partir del cual se hace map-reduce. */
export const LONG_TRANSCRIPT_CHARS = 60_000;

/**
 * Timeout para las generaciones de calidad (modelo de razonamiento, salidas largas).
 * Estos generadores corren sólo en rutas con maxDuration=300: 240 s deja margen para
 * persistir el resultado o el estado de error sin que Vercel mate la función.
 */
const REASONING_TIMEOUT_MS = 240_000;
/** Tamaño objetivo de cada tramo en map-reduce. */
const PART_CHARS = 35_000;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const summarySchema = z.object({
  summary_md: z.string().min(200),
  key_points: z.array(z.string().min(10)).min(5).max(10),
  sections: z
    .array(z.object({ title: z.string().min(2), body_md: z.string().min(40) }))
    .min(2)
    .max(8),
  glossary: z
    .array(z.object({ term: z.string().min(2), definition: z.string().min(10) }))
    .min(3)
    .max(12),
});

export interface SummaryOutput {
  summary_md: string;
  key_points: string[];
  sections: SummarySection[];
  glossary: GlossaryTerm[];
}

const tag = z.string().min(2).max(40).optional();

const cardSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flashcard"), question: z.string().min(5), answer: z.string().min(5), tag }),
  z.object({
    type: z.literal("quiz"),
    question: z.string().min(5),
    options: z.array(z.string().min(1)).length(4),
    correct_index: z.number().int().min(0).max(3),
    explanation: z.string().min(10),
    tag,
  }),
  z.object({ type: z.literal("concept"), title: z.string().min(2), body_md: z.string().min(40), tag }),
]);

export const cardsSchema = z.object({ cards: z.array(cardSchema).min(10).max(20) });

const notesSchema = z.object({ notes_md: z.string().min(50) });

const simplifiedSchema = z.object({ content_md: z.string().min(300) });

// ---------------------------------------------------------------------------
// Map-reduce para transcripciones largas
// ---------------------------------------------------------------------------

/** Parte el texto en tramos de ~PART_CHARS cortando en límites de oración. */
export function splitIntoParts(text: string, partChars: number = PART_CHARS): string[] {
  if (text.length <= partChars) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > partChars) {
    let cut = rest.lastIndexOf(". ", partChars);
    if (cut < partChars * 0.5) cut = rest.lastIndexOf(" ", partChars);
    if (cut <= 0) cut = partChars;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export interface CondensedTranscript {
  text: string;
  /** true si se aplicó map-reduce */
  condensed: boolean;
  parts: number;
}

/**
 * Si la transcripción supera el umbral, genera notas densas por tramo (modelo rápido)
 * y devuelve su concatenación; si no, devuelve el texto original.
 */
export async function condenseTranscript(transcript: string): Promise<CondensedTranscript> {
  const clean = transcript.replace(/\s+/g, " ").trim();
  if (clean.length <= LONG_TRANSCRIPT_CHARS) return { text: clean, condensed: false, parts: 1 };

  const parts = splitIntoParts(clean);
  const notes: string[] = new Array<string>(parts.length);
  // Los tramos son independientes: se procesan en paralelo acotado para bajar la latencia
  // total (secuencial, una clase de 3 h suma 100-200 s sólo de condensación).
  const CONCURRENCY = 3;
  for (let start = 0; start < parts.length; start += CONCURRENCY) {
    await Promise.all(
      parts.slice(start, start + CONCURRENCY).map(async (part, offset) => {
        const i = start + offset;
        const res = await chatJSON({
          schema: notesSchema,
          system: CHUNK_NOTES_SYSTEM,
          user: `TRAMO ${i + 1} de ${parts.length}:\n"""\n${part}\n"""\n\nDevolvé { "notes_md": string } con notas en Markdown (300 a 700 palabras).`,
          model: MODELS.fast,
          temperature: 0.2,
          maxTokens: 2_500,
        });
        notes[i] = `## Tramo ${i + 1}\n${res.data.notes_md.trim()}`;
      }),
    );
  }
  return { text: notes.join("\n\n"), condensed: true, parts: parts.length };
}

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

export interface GenerateContext {
  /** Transcripción ya condensada si era larga (evita repetir el map-reduce). */
  condensed?: CondensedTranscript;
  title?: string | null;
}

async function inputText(transcript: string, ctx?: GenerateContext): Promise<string> {
  const c = ctx?.condensed ?? (await condenseTranscript(transcript));
  return c.text;
}

export async function generateSummary(transcript: string, ctx?: GenerateContext): Promise<ChatResult<SummaryOutput>> {
  const text = await inputText(transcript, ctx);
  const res = await chatJSON({
    schema: summarySchema,
    system: SUMMARY_SYSTEM,
    user: summaryUserPrompt(text, ctx?.title),
    model: MODELS.reasoning,
    temperature: 0.3,
    maxTokens: 4_000,
    timeoutMs: REASONING_TIMEOUT_MS,
  });
  return res;
}

export async function generateCards(
  transcript: string,
  summary: Pick<SummaryOutput, "summary_md" | "key_points">,
  ctx?: GenerateContext,
): Promise<ChatResult<InteractiveCardItem[]>> {
  const text = await inputText(transcript, ctx);
  const res = await chatJSON({
    schema: cardsSchema,
    system: CARDS_SYSTEM,
    user: cardsUserPrompt(text, summary.summary_md, summary.key_points),
    model: MODELS.reasoning,
    temperature: 0.5,
    maxTokens: 6_000,
    timeoutMs: REASONING_TIMEOUT_MS,
  });
  return { ...res, data: res.data.cards };
}

export async function generateSimplified(
  transcript: string,
  level: SimplifiedLevel,
  ctx?: GenerateContext & { summaryMd?: string | null },
): Promise<ChatResult<string>> {
  const text = await inputText(transcript, ctx);
  const res = await chatJSON({
    schema: simplifiedSchema,
    system: `${simplifiedSystem(level)}\n\nDevolvé { "content_md": string } con el Markdown completo.`,
    user: simplifiedUserPrompt(text, ctx?.summaryMd),
    model: MODELS.fast,
    temperature: 0.4,
    maxTokens: 3_500,
  });
  return { ...res, data: res.data.content_md.trim() };
}

export type { SimplifiedLevel };
