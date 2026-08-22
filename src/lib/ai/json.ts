/**
 * Extracción robusta de JSON desde la salida de un LLM.
 * Tolera: bloques ```json ... ```, texto antes/después, y comas finales.
 */
export class JsonExtractError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "JsonExtractError";
  }
}

function tryParse<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

/** Devuelve el primer bloque balanceado `{...}` o `[...]` encontrado (ignora llaves dentro de strings). */
function firstBalancedBlock(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function stripTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, "$1");
}

export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();

  // 1) Tal cual
  const direct = tryParse<T>(trimmed);
  if (direct !== undefined) return direct;

  // 2) Dentro de un fence ```json ... ```
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    const parsed = tryParse<T>(inner) ?? tryParse<T>(stripTrailingCommas(inner));
    if (parsed !== undefined) return parsed;
  }

  // 3) Primer bloque balanceado
  const block = firstBalancedBlock(trimmed);
  if (block) {
    const parsed = tryParse<T>(block) ?? tryParse<T>(stripTrailingCommas(block));
    if (parsed !== undefined) return parsed;
  }

  throw new JsonExtractError("La respuesta del modelo no contiene JSON válido.", text);
}
