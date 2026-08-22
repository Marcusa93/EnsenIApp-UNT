import type { IndexedCard } from "@/components/class-content/parse";

export interface CardProgressState {
  known: boolean;
  attempts: number;
  correct: number;
}

/** card_index → progreso acumulado (persistido en card_progress). */
export type ProgressMap = Record<number, CardProgressState>;

/** Resultado de una placa dentro de la sesión actual (no acumulado). */
export interface SessionOutcome {
  index: number;
  type: IndexedCard["card"]["type"];
  tag?: string;
  known: boolean;
  /** Sólo quiz: si la respuesta fue correcta. */
  correct?: boolean;
}

export interface SessionStats {
  total: number;
  known: number;
  quizTotal: number;
  quizCorrect: number;
  weakTags: { tag: string; misses: number }[];
  toReview: number[];
}
