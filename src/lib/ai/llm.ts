import { z } from "zod";
import { openrouter, MODELS, assertOpenRouterConfigured } from "@/lib/openrouter";
import { extractJson, JsonExtractError } from "@/lib/ai/json";

export type ModelId = (typeof MODELS)[keyof typeof MODELS] | (string & {});

export interface ChatTextOptions {
  system: string;
  user: string;
  /** Por defecto MODELS.reasoning */
  model?: ModelId;
  temperature?: number;
  maxTokens?: number;
  /**
   * Timeout de ESTA llamada en ms. Por defecto rige el del cliente (100 s, apto para
   * rutas con maxDuration=120); las rutas con más presupuesto pueden subirlo.
   */
  timeoutMs?: number;
}

export interface ChatJSONOptions<S extends z.ZodType> extends Omit<ChatTextOptions, "maxTokens"> {
  schema: S;
  /** Reintentos ante JSON inválido o fallo de validación (default 2). */
  retries?: number;
  maxTokens?: number;
}

export interface ChatResult<T> {
  data: T;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number } | null;
  attempts: number;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/**
 * El modelo respondió pero nunca produjo un JSON que valide contra el schema
 * (agotó los reintentos de `chatJSON`). Es un fallo determinístico: reintentar
 * el mismo pedido con backoff casi seguro vuelve a fallar, así que quien lo
 * atrape debería tratarlo como permanente (4xx) y no como transitorio.
 */
export class LLMValidationError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "LLMValidationError";
  }
}

async function completion(params: {
  model: string;
  temperature: number;
  maxTokens?: number;
  timeoutMs?: number;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  json: boolean;
}) {
  try {
    const res = await openrouter.chat.completions.create(
      {
        model: params.model,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        messages: params.messages,
        ...(params.json ? { response_format: { type: "json_object" as const } } : {}),
      },
      params.timeoutMs ? { timeout: params.timeoutMs } : undefined,
    );
    const choice = res.choices?.[0];
    const content = choice?.message?.content ?? "";
    return {
      content,
      finishReason: choice?.finish_reason ?? null,
      model: res.model ?? params.model,
      usage: res.usage
        ? { prompt_tokens: res.usage.prompt_tokens, completion_tokens: res.usage.completion_tokens }
        : null,
    };
  } catch (err) {
    console.error("[llm] error en chat.completions", { model: params.model, err });
    throw new LLMError("No se pudo obtener respuesta del modelo. Intentá de nuevo en unos segundos.", err);
  }
}

/** Texto libre (markdown) desde el modelo. */
export async function chatText(opts: ChatTextOptions): Promise<ChatResult<string>> {
  assertOpenRouterConfigured();
  const model = opts.model ?? MODELS.reasoning;
  const res = await completion({
    model,
    temperature: opts.temperature ?? 0.4,
    maxTokens: opts.maxTokens,
    timeoutMs: opts.timeoutMs,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    json: false,
  });
  if (!res.content.trim()) throw new LLMError("El modelo devolvió una respuesta vacía.");
  return { data: res.content, model: res.model, usage: res.usage, attempts: 1 };
}

/** Describe el schema de zod en texto para el prompt (suficiente para guiar al modelo). */
function describeSchema(schema: z.ZodType): string {
  try {
    return JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any" }), null, 0);
  } catch {
    return "(schema no representable; respetá la descripción del sistema)";
  }
}

/**
 * JSON estricto validado con zod. Si el JSON no parsea o no valida, reintenta
 * agregando el error al diálogo para que el modelo corrija.
 */
export async function chatJSON<S extends z.ZodType>(opts: ChatJSONOptions<S>): Promise<ChatResult<z.output<S>>> {
  assertOpenRouterConfigured();
  const model = opts.model ?? MODELS.reasoning;
  const retries = opts.retries ?? 2;
  const system = `${opts.system}

REGLAS DE SALIDA (obligatorias):
- Respondé ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después, sin bloques de código.
- Usá exactamente las claves del esquema. Sin comas finales. Strings con comillas dobles.
- Esquema JSON esperado: ${describeSchema(opts.schema)}`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: opts.user },
  ];

  let lastError: unknown;
  let maxTokens = opts.maxTokens;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const res = await completion({
      model,
      temperature: opts.temperature ?? 0.2,
      maxTokens,
      timeoutMs: opts.timeoutMs,
      messages,
      json: true,
    });

    let parsed: unknown;
    try {
      parsed = extractJson(res.content);
    } catch (err) {
      lastError = err;
      if (res.finishReason === "length") {
        // Salida truncada por max_tokens: repetir con el mismo límite es inútil.
        // Se sube el tope y NO se re-manda la respuesta truncada (ahorra prompt).
        console.warn("[llm] salida truncada por max_tokens", { model, attempt, maxTokens });
        if (maxTokens) {
          maxTokens = Math.ceil(maxTokens * 1.5);
          continue;
        }
        throw new LLMError("La respuesta del modelo excedió el límite de tokens configurado.", err);
      }
      const snippet = err instanceof JsonExtractError ? err.raw.slice(0, 400) : "";
      console.warn("[llm] JSON inválido", { model, attempt, snippet });
      messages.push({ role: "assistant", content: res.content });
      messages.push({
        role: "user",
        content:
          "Tu respuesta anterior no era JSON válido. Respondé de nuevo SOLO con el objeto JSON, sin explicaciones ni bloques de código.",
      });
      continue;
    }

    const result = opts.schema.safeParse(parsed);
    if (result.success) {
      return { data: result.data, model: res.model, usage: res.usage, attempts: attempt };
    }

    lastError = result.error;
    const issues = result.error.issues
      .slice(0, 8)
      .map((i) => `- ${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("\n");
    console.warn("[llm] JSON no valida contra el schema", { model, attempt, issues });
    messages.push({ role: "assistant", content: res.content });
    messages.push({
      role: "user",
      content: `El JSON no cumple el esquema. Errores:\n${issues}\n\nCorregilos y respondé de nuevo SOLO con el objeto JSON completo.`,
    });
  }

  throw new LLMValidationError(
    `El modelo no produjo un JSON válido después de ${retries + 1} intentos.`,
    lastError,
  );
}
