import { z } from "zod";
import { chatJSON } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import type { GameKey } from "./config";

/**
 * Generación de desafíos desde el material real de una grabación.
 *
 * Regla que atraviesa los tres juegos: NADA se inventa. Todo desafío tiene que
 * poder respaldarse con una cita textual de la clase — es el mismo criterio con
 * el que trabaja Alberdi. Si el modelo no encuentra material para una pregunta,
 * preferimos menos desafíos antes que preguntas de relleno.
 */

const challengeSchema = z.object({
  prompt: z.string().trim().min(8).max(400),
  options: z.array(z.string().trim().min(1).max(200)).min(3).max(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(500),
  source_quote: z.string().trim().min(5).max(600),
  difficulty: z.number().int().min(1).max(3).default(1),
});

const batchSchema = z.object({ challenges: z.array(challengeSchema).max(12) });

export type GeneratedChallenge = z.infer<typeof challengeSchema>;

const SYSTEM = `Sos parte del equipo docente de "Derecho de las Nuevas Tecnologías y Bioderecho" (Facultad de Derecho, UNT).
Preparás desafíos de repaso para estudiantes de abogacía, en español rioplatense.

Reglas que no se negocian:
- Todo lo que preguntes tiene que estar EXPLÍCITAMENTE en el material que te paso. No agregues doctrina, fallos ni datos de afuera.
- "source_quote" es una cita TEXTUAL del material (copiada, no parafraseada) que prueba la respuesta correcta.
- Las opciones incorrectas tienen que ser plausibles para alguien que no estudió, pero claramente falsas para quien siguió la clase. Nada de opciones absurdas ni de descartar por el largo.
- Nunca uses "todas las anteriores" ni "ninguna de las anteriores".
- Una sola opción puede ser correcta.
- Si el material no da para la cantidad pedida, devolvé menos desafíos. Preferimos pocos y buenos.
- Escribí como le hablarías a un estudiante: claro y directo, sin solemnidad innecesaria.`;

const INSTRUCTIONS: Record<GameKey, string> = {
  duelo: `Generá preguntas de opción múltiple (4 opciones) sobre los CONCEPTOS de la clase: qué significa algo, qué distingue una figura de otra, qué consecuencia jurídica tiene un hecho.
Apuntá a comprensión, no a memoria literal: evitá preguntar fechas o nombres sueltos.`,

  glosario: `Generá preguntas que tomen un TÉRMINO técnico de la clase y pidan reconocer su significado dentro de esta materia.
El "prompt" es el término (o una pregunta corta sobre él) y las opciones son definiciones breves. Las definiciones incorrectas deben ser de conceptos vecinos y reales, no inventos.`,

  momento: `Generá desafíos de ubicación temporal. El "prompt" es una frase textual llamativa que se dijo en la clase (copiala tal cual, entre comillas).
Las opciones son cuatro tramos de tiempo con formato "mm:ss – mm:ss" y hay que elegir en cuál se dijo.
IMPORTANTE: usá las marcas [mm:ss] que vienen en la transcripción para saber el momento real, y armá las opciones incorrectas con tramos que existan dentro de la clase.
En "explanation" contá brevemente de qué se estaba hablando en ese momento.`,
};

export interface GenerateInput {
  game: GameKey;
  /** Material de la clase: transcripción con marcas [mm:ss], resumen o glosario. */
  material: string;
  classTopic: string;
  count: number;
}

export async function generateChallenges(input: GenerateInput): Promise<GeneratedChallenge[]> {
  const { game, material, classTopic, count } = input;

  const res = await chatJSON({
    system: SYSTEM,
    user: `Clase: ${classTopic}

${INSTRUCTIONS[game]}

Generá hasta ${count} desafíos.

Material de la clase:
"""
${material}
"""`,
    schema: batchSchema,
    // Sonnet para esto: la calidad de los distractores es lo que hace o rompe el juego.
    model: MODELS.reasoning,
    temperature: 0.7,
    maxTokens: 8000,
  });

  // El schema ya garantiza forma; acá filtramos lo que sería injugable.
  return res.data.challenges.filter((c) => {
    if (c.correct_index >= c.options.length) return false;
    const unique = new Set(c.options.map((o) => o.toLowerCase().trim()));
    return unique.size === c.options.length;
  });
}

/** Convierte segundos a mm:ss para las marcas de "¿en qué minuto?". */
export function mmss(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Sin puntuación, sin tildes y con espacios normalizados: así compara parejo. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ubica la cita dentro de la transcripción para poder guardar el segundo exacto
 * (así el estudiante puede ir a escuchar ese tramo después de contestar).
 *
 * Whisper corta en micro-segmentos, así que una cita de una línea casi siempre
 * cruza varios: se busca sobre el texto concatenado y después se mapea la
 * posición encontrada al segmento que la contiene.
 */
export function findQuoteSeconds(
  quote: string,
  segments: { start?: number; text?: string }[],
): number | null {
  const needle = normalize(quote);
  if (needle.length < 12) return null;

  // Texto corrido + índice de dónde arranca cada segmento dentro de él.
  const starts: { at: number; seconds: number }[] = [];
  let full = "";
  for (const seg of segments) {
    if (typeof seg.start !== "number" || !seg.text) continue;
    const piece = normalize(seg.text);
    if (!piece) continue;
    if (full) full += " ";
    starts.push({ at: full.length, seconds: seg.start });
    full += piece;
  }
  if (starts.length === 0) return null;

  const locate = (at: number): number => {
    // Último segmento que arranca antes (o justo en) la posición hallada.
    let found = starts[0].seconds;
    for (const s of starts) {
      if (s.at > at) break;
      found = s.seconds;
    }
    return found;
  };

  const direct = full.indexOf(needle);
  if (direct >= 0) return locate(direct);

  // El modelo suele recortar o unir la cita: probamos con un prefijo largo y,
  // si tampoco, con las primeras palabras.
  for (const size of [80, 50, 30]) {
    if (needle.length <= size) continue;
    const at = full.indexOf(needle.slice(0, size));
    if (at >= 0) return locate(at);
  }

  const head = needle.split(" ").slice(0, 6).join(" ");
  if (head.length < 12) return null;
  const at = full.indexOf(head);
  return at >= 0 ? locate(at) : null;
}
