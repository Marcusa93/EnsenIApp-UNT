/**
 * Normaliza una palabra o frase corta para agrupar en la nube de palabras:
 * lowercase, sin acentos, sin signos, sin stop-words, con sufijos comunes
 * recortados y tokens ordenados alfabéticamente.
 *
 *   "Estafa"     y "estafas"        → "estaf"
 *   "el hackeo"  y "hackeo"         → "hackeo"
 *   "robo virtual" y "virtual robo" → "robo virtual" (mismo grupo, cualquier orden)
 */

const STOP_WORDS = new Set([
  "el", "la", "los", "las",
  "un", "una", "unos", "unas",
  "de", "del", "al", "a", "y", "o", "u",
  "en", "para", "por", "con", "sin",
  "mi", "mis", "tu", "tus", "su", "sus",
  "que", "se", "le", "lo", "es", "ser",
]);

const SUFFIXES = [
  "miento", "amiento", "imiento",
  "acion", "icion", "cion", "sion",
  "mente", "idad", "edad",
  "ancia", "encia",
  "able", "ible",
  "ado", "ada", "ido", "ida",
  "oso", "osa",
  "ar", "er", "ir",
];

function stem(word: string): string {
  let w = word;
  if (w.endsWith("ones") && w.length > 5) w = w.slice(0, -3) + "on";
  else if (w.endsWith("ces") && w.length > 4) w = w.slice(0, -3) + "z";
  else if (w.endsWith("es") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("s") && w.length > 3) w = w.slice(0, -1);

  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w;
}

export function normalizeWord(input: string): string {
  const cleaned = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return "";

  const tokens = cleaned
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    .map(stem)
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return cleaned;
  return [...tokens].sort().join(" ");
}
