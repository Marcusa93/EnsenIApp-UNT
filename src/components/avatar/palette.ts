/**
 * Paleta del operador.
 *
 * El estilo es deliberadamente GEOMÉTRICO y plano: formas limpias, pocos colores
 * y luz de neón. No hay rostro humano — el chasis lleva un visor iluminado. Es
 * una decisión de diseño, no una limitación: los rostros dibujados a mano se ven
 * amateur enseguida, y una máscara tecnológica es además lo coherente con un
 * "operador jurídico aumentado".
 */

export interface Palette {
  /** Color de luz del operador: visor, ribetes, aura. */
  glow: string;
  glowSoft: string;
  glowDeep: string;
  /** Chasis: cuerpo y casco. */
  shell: string;
  shellDark: string;
  shellLight: string;
  /** Tela de la toga. */
  cloth: string;
  clothDark: string;
}

export const GLOWS = [
  { id: "violeta", name: "Violeta", hex: "#7c5cff" },
  { id: "verde", name: "Verde", hex: "#3ddc97" },
  { id: "cian", name: "Cian", hex: "#22d3ee" },
  { id: "ambar", name: "Ámbar", hex: "#f5a524" },
  { id: "rosa", name: "Magenta", hex: "#f472b6" },
  { id: "carmesi", name: "Carmesí", hex: "#fb5c6c" },
] as const;

export const TONES = [
  { id: "acero", name: "Acero", shell: "#8993a6", dark: "#5b6474", light: "#b6bfce" },
  { id: "grafito", name: "Grafito", shell: "#4d5462", dark: "#333944", light: "#727b8b" },
  { id: "titanio", name: "Titanio", shell: "#c3ccdb", dark: "#8d97a8", light: "#e4e9f1" },
  { id: "bronce", name: "Bronce", shell: "#b5895c", dark: "#7d5c3a", light: "#d6ac7e" },
] as const;

/** Modelos de chasis: la silueta de la cabeza es lo que más distingue un
 *  operador de otro, así que conviene que haya variedad real y no sólo color. */
export const CHASSIS = [
  { id: "redondo", name: "Curvo", hint: "Perfil clásico, lectura serena." },
  { id: "angular", name: "Angular", hint: "Aristas marcadas, presencia firme." },
  { id: "encapuchado", name: "Encapuchado", hint: "Capucha técnica sobre el chasis." },
  { id: "bloque", name: "Bloque", hint: "Cabeza cuadrada, escuela vieja." },
  { id: "domo", name: "Domo", hint: "Cúpula de cristal sobre el módulo." },
  { id: "antenas", name: "Antenas", hint: "Dos receptores laterales siempre atentos." },
  { id: "visorpleno", name: "Casco pleno", hint: "Un solo cristal envolvente, sin costuras." },
  { id: "crestado", name: "Crestado", hint: "Cresta dorsal alta. Difícil pasar desapercibido." },
] as const;

/** Complexión: cambia el ancho y la profundidad del cuerpo entero. */
export const BUILDS = [
  { id: "estandar", name: "Estándar", scale: 1, hint: "Proporción equilibrada." },
  { id: "compacto", name: "Compacto", scale: 0.86, hint: "Bajo y ágil." },
  { id: "robusto", name: "Robusto", scale: 1.18, hint: "Ancho de hombros, presencia física." },
  { id: "estilizado", name: "Estilizado", scale: 0.94, hint: "Alto y delgado." },
] as const;

export type GlowId = (typeof GLOWS)[number]["id"];
export type ToneId = (typeof TONES)[number]["id"];
export type ChassisId = (typeof CHASSIS)[number]["id"];
export type BuildId = (typeof BUILDS)[number]["id"];

/** Mezcla hacia negro/blanco sin depender de CSS: los SVG se sirven inline. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (to - c) * t);
  };
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function buildPalette(glowId: string, toneId: string): Palette {
  const glow = GLOWS.find((g) => g.id === glowId) ?? GLOWS[0];
  const tone = TONES.find((t) => t.id === toneId) ?? TONES[0];
  return {
    glow: glow.hex,
    glowSoft: shade(glow.hex, 0.35),
    glowDeep: shade(glow.hex, -0.4),
    shell: tone.shell,
    shellDark: tone.dark,
    shellLight: tone.light,
    // La toga siempre es oscura: el color del operador es la luz, no la tela.
    cloth: "#232838",
    clothDark: "#171b27",
  };
}
