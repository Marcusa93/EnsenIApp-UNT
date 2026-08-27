/**
 * Emotes del operador.
 *
 * TODOS son originales de la cátedra. No se reproducen bailes de videojuegos ni
 * coreografías de terceros: son obras ajenas con derechos vigentes (Epic Games
 * fue demandada por varias de las suyas), y sería incoherente que la app de una
 * materia que enseña derechos intelectuales los use sin licencia. Los gestos
 * genéricos —saludar, pulgar arriba— no son de nadie y sí se pueden usar.
 *
 * Cada emote es una clase CSS que anima los grupos etiquetados del muñeco
 * (.av-arm-l, .av-arm-r, .av-head, .av-body). El rig no se toca.
 */

export interface Emote {
  id: string;
  name: string;
  description: string;
  /** Clase CSS que dispara la animación. */
  className: string;
  /** Cuánto dura una vuelta, en ms: para saber cuándo apagarlo. */
  duration: number;
  /** Cómo se gana. Espeja avatar_items.req_kind. */
  req: { kind: "inicio" | "nivel" | "racha" | "aciertos" | "partidas"; value: number };
  emoji: string;
}

export const EMOTES: Emote[] = [
  {
    id: "saludo",
    name: "Saludo del estrado",
    description: "El saludo de rigor antes de empezar.",
    className: "em-saludo",
    duration: 1600,
    req: { kind: "inicio", value: 0 },
    emoji: "👋",
  },
  {
    id: "objecion",
    name: "¡Objeción!",
    description: "El brazo al frente y la mirada firme. Un clásico de la profesión.",
    className: "em-objecion",
    duration: 1400,
    req: { kind: "inicio", value: 0 },
    emoji: "☝️",
  },
  {
    id: "festejo",
    name: "Fallo favorable",
    description: "Los dos brazos arriba. Ganaste y se nota.",
    className: "em-festejo",
    duration: 1800,
    req: { kind: "partidas", value: 3 },
    emoji: "🙌",
  },
  {
    id: "martillazo",
    name: "Martillazo",
    description: "Se levanta, cae y se cierra la discusión.",
    className: "em-martillazo",
    duration: 1500,
    req: { kind: "aciertos", value: 20 },
    emoji: "🔨",
  },
  {
    id: "seissiete",
    name: "Seis siete",
    description: "Una mano y la otra, midiendo. Que cada cual interprete.",
    className: "em-seissiete",
    duration: 2000,
    req: { kind: "partidas", value: 8 },
    emoji: "🤷",
  },
  {
    id: "toga",
    name: "Vuelta de toga",
    description: "El giro con la toga al viento. Reservado para la salida triunfal.",
    className: "em-toga",
    duration: 2200,
    req: { kind: "nivel", value: 5 },
    emoji: "🌀",
  },
  {
    id: "meditar",
    name: "A pensar",
    description: "La mano en el mentón: el gesto universal de estar armando el argumento.",
    className: "em-meditar",
    duration: 2400,
    req: { kind: "racha", value: 4 },
    emoji: "🤔",
  },
  {
    id: "victoria",
    name: "Sentencia firme",
    description: "Brazos abiertos, aura al máximo. Sólo para quien llegó lejos.",
    className: "em-victoria",
    duration: 2600,
    req: { kind: "nivel", value: 9 },
    emoji: "⚡",
  },
];

export const EMOTE_BY_ID = new Map(EMOTES.map((e) => [e.id, e]));

/** El que se dispara solo al ganar una partida (si ya lo tiene). */
export const CELEBRATION_EMOTE = "festejo";

export interface EmoteProgress {
  level: number;
  streak: number;
  correct: number;
  runs: number;
}

export function isEmoteUnlocked(emote: Emote, p: EmoteProgress): boolean {
  switch (emote.req.kind) {
    case "inicio":
      return true;
    case "nivel":
      return p.level >= emote.req.value;
    case "racha":
      return p.streak >= emote.req.value;
    case "aciertos":
      return p.correct >= emote.req.value;
    case "partidas":
      return p.runs >= emote.req.value;
  }
}

export function emoteRequirement(emote: Emote, levelName?: string): string {
  switch (emote.req.kind) {
    case "inicio":
      return "Disponible desde el inicio";
    case "nivel":
      return levelName ? `Nivel ${emote.req.value} · ${levelName}` : `Nivel ${emote.req.value}`;
    case "racha":
      return `Jugá ${emote.req.value} días seguidos`;
    case "aciertos":
      return `Acertá ${emote.req.value} respuestas`;
    case "partidas":
      return `Jugá ${emote.req.value} partidas`;
  }
}
