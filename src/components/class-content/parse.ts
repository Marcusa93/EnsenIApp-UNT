import type { Json } from "@/lib/types/database";
import type { GlossaryTerm, InteractiveCardItem, SummarySection, TranscriptSegment } from "@/lib/types/helpers";

/**
 * Casteos defensivos de columnas JSONB al borde (server). Descartan ítems malformados
 * en vez de romper la pantalla: el contenido lo genera un LLM y puede venir incompleto.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(json: Json | null | undefined): unknown[] {
  return Array.isArray(json) ? json : [];
}

export function parseKeyPoints(json: Json | null | undefined): string[] {
  return asArray(json)
    .map((p) => (typeof p === "string" ? p : isRecord(p) && typeof p.text === "string" ? p.text : null))
    .filter((p): p is string => Boolean(p && p.trim()));
}

export function parseSections(json: Json | null | undefined): SummarySection[] {
  return asArray(json).flatMap((s) => {
    if (!isRecord(s) || typeof s.title !== "string") return [];
    const body = typeof s.body_md === "string" ? s.body_md : typeof s.body === "string" ? s.body : "";
    return body.trim() ? [{ title: s.title, body_md: body }] : [];
  });
}

export function parseGlossary(json: Json | null | undefined): GlossaryTerm[] {
  return asArray(json).flatMap((g) => {
    if (!isRecord(g) || typeof g.term !== "string" || typeof g.definition !== "string") return [];
    return g.term.trim() ? [{ term: g.term, definition: g.definition }] : [];
  });
}

export function parseSegments(json: Json | null | undefined): TranscriptSegment[] {
  return asArray(json).flatMap((s) => {
    if (!isRecord(s) || typeof s.text !== "string") return [];
    const start = typeof s.start === "number" ? s.start : Number(s.start);
    const end = typeof s.end === "number" ? s.end : Number(s.end);
    if (!Number.isFinite(start)) return [];
    return [{ start, end: Number.isFinite(end) ? end : start, text: s.text }];
  });
}

/**
 * Placas: cada ítem conserva su índice original en el array (card_index en card_progress),
 * aunque se descarten ítems inválidos en el medio.
 */
export interface IndexedCard {
  index: number;
  card: InteractiveCardItem;
}

export function parseCards(json: Json | null | undefined): IndexedCard[] {
  const out: IndexedCard[] = [];
  asArray(json).forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const tag = typeof raw.tag === "string" && raw.tag.trim() ? raw.tag.trim() : undefined;
    if (raw.type === "flashcard" && typeof raw.question === "string" && typeof raw.answer === "string") {
      out.push({ index, card: { type: "flashcard", question: raw.question, answer: raw.answer, tag } });
    } else if (
      raw.type === "quiz" &&
      typeof raw.question === "string" &&
      Array.isArray(raw.options) &&
      raw.options.every((o): o is string => typeof o === "string") &&
      raw.options.length >= 2 &&
      typeof raw.correct_index === "number" &&
      raw.correct_index >= 0 &&
      raw.correct_index < raw.options.length
    ) {
      out.push({
        index,
        card: {
          type: "quiz",
          question: raw.question,
          options: raw.options,
          correct_index: raw.correct_index,
          explanation: typeof raw.explanation === "string" ? raw.explanation : "",
          tag,
        },
      });
    } else if (raw.type === "concept" && typeof raw.title === "string" && typeof raw.body_md === "string") {
      out.push({ index, card: { type: "concept", title: raw.title, body_md: raw.body_md, tag } });
    }
  });
  return out;
}

/** "hh:mm:ss" / "mm:ss" para timestamps de transcripción. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
