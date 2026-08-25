/**
 * Código de sesión en vivo: 5 caracteres, alfabeto sin vocales ni caracteres
 * ambiguos (0/O, 1/I/L) para que se pueda leer en voz alta o escribir en un
 * celular sin errores.
 */
const ALPHABET = "BCDFGHJKMNPQRSTVWXYZ23456789";

export function generateLiveCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** El estudiante puede escribirlo en minúsculas, con espacios, etc. */
export function normalizeLiveCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
