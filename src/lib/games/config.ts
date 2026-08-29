import type { Enums } from "@/lib/types/helpers";

/**
 * "El Expediente" — definición de los juegos y de la progresión.
 *
 * Los niveles siguen la carrera judicial a propósito: para un estudiante de
 * Derecho, "llegar a Camarista" dice mucho más que "llegar a nivel 8".
 */

export type GameKey = Enums<"game_key">;

export interface GameMeta {
  key: GameKey;
  name: string;
  tagline: string;
  /** Cómo se juega, en una línea. */
  how: string;
  emoji: string;
  /** Clase de color de acento para las tarjetas. */
  tone: "accent" | "accent-2" | "accent-3";
}

export const GAMES: GameMeta[] = [
  {
    key: "duelo",
    name: "Duelo de conceptos",
    tagline: "Cinco preguntas sobre lo que se dijo en clase.",
    how: "Elegí la opción correcta. Cada acierto suma XP.",
    emoji: "⚔️",
    tone: "accent",
  },
  {
    key: "momento",
    name: "¿En qué minuto?",
    tagline: "Te damos una frase textual: ubicá cuándo se dijo.",
    how: "Elegí el tramo de la clase donde apareció esa frase.",
    emoji: "🎧",
    tone: "accent-2",
  },
  {
    key: "glosario",
    name: "Glosario relámpago",
    tagline: "Término y definición, contrarreloj.",
    how: "Emparejá cada término con lo que significa en la materia.",
    emoji: "📖",
    tone: "accent-3",
  },
];

export const GAME_BY_KEY = new Map(GAMES.map((g) => [g.key, g]));

/** Preguntas por partida. Corta: la gracia es poder jugar en el colectivo. */
export const ROUND_SIZE = 5;

/** XP por respuesta correcta. */
export const XP_PER_CORRECT = 10;
/** Extra por partida perfecta: premia el repaso completo, no la suerte. */
export const XP_PERFECT_BONUS = 15;

export function xpForRun(correct: number, total: number): number {
  const base = correct * XP_PER_CORRECT;
  return correct === total && total > 0 ? base + XP_PERFECT_BONUS : base;
}

/** Bonus para quien gana un reto contra un compañero, arriba del XP de la partida. */
export const DUEL_WIN_BONUS = 25;
/** Si empatan, un consuelo para los dos — nadie sale con las manos vacías. */
export const DUEL_DRAW_BONUS = 10;

export interface Level {
  n: number;
  name: string;
  /** XP necesario para alcanzarlo. */
  xp: number;
}

/** La carrera: de entrar a la facultad a escribir doctrina. */
export const LEVELS: Level[] = [
  { n: 1, name: "Ingresante", xp: 0 },
  { n: 2, name: "Cursante", xp: 80 },
  { n: 3, name: "Pasante", xp: 200 },
  { n: 4, name: "Procurador", xp: 400 },
  { n: 5, name: "Abogado", xp: 700 },
  { n: 6, name: "Litigante", xp: 1100 },
  { n: 7, name: "Asesor letrado", xp: 1600 },
  { n: 8, name: "Fiscal", xp: 2300 },
  { n: 9, name: "Juez de primera instancia", xp: 3200 },
  { n: 10, name: "Camarista", xp: 4300 },
  { n: 11, name: "Ministro de la Corte", xp: 5800 },
  { n: 12, name: "Jurista", xp: 7500 },
];

export interface LevelProgress {
  level: Level;
  next: Level | null;
  /** 0..1 dentro del nivel actual. En el último nivel, 1. */
  ratio: number;
  xpIntoLevel: number;
  xpForNext: number;
}

export function levelFor(xp: number): LevelProgress {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) index = i;
  }
  const level = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  if (!next) return { level, next: null, ratio: 1, xpIntoLevel: xp - level.xp, xpForNext: 0 };

  const span = next.xp - level.xp;
  const into = xp - level.xp;
  return { level, next, ratio: Math.min(1, into / span), xpIntoLevel: into, xpForNext: span - into };
}
