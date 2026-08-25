/**
 * Contrato compartido cliente/servidor del pipeline de grabaciones.
 * Sin dependencias de Node ni del DOM: se importa desde el Route Handler
 * y desde los componentes cliente.
 */
import type { Enums } from "@/lib/types/helpers";

export type RecordingStatus = Enums<"recording_status">;

/** Sub-pasos de la fase `generating` (se guardan en class_recordings.current_step). */
export const GENERATION_STEPS = ["summary", "cards", "simplified_facil", "simplified_intermedio"] as const;
export type GenerationStep = (typeof GENERATION_STEPS)[number];

export function isGenerationStep(v: unknown): v is GenerationStep {
  return typeof v === "string" && (GENERATION_STEPS as readonly string[]).includes(v);
}

/** Progreso (0-100) reservado a cada fase. */
export const PROGRESS = {
  uploaded: 5,
  transcribingFrom: 10,
  transcribingTo: 70,
  processing: 72,
  generating: { summary: 75, cards: 82, simplified_facil: 88, simplified_intermedio: 94 } satisfies Record<GenerationStep, number>,
  ready: 100,
} as const;

export interface StepResponse {
  status: RecordingStatus;
  progress: number;
  current_step: string | null;
  chunks_done: number;
  chunks_total: number;
  done: boolean;
  error?: string;
}

export interface ProcessingLogEntry {
  at: string;
  step: string;
  message: string;
}

/** Etiqueta humana de lo que está haciendo el pipeline ahora. */
export function describeStep(status: RecordingStatus | null | undefined, currentStep: string | null | undefined): string {
  switch (status) {
    case "uploaded":
      return "En cola para transcribir";
    case "transcribing":
      return "Transcribiendo el audio";
    case "processing":
      return "Armando la transcripción completa";
    case "generating":
      switch (currentStep) {
        case "summary":
          return "Generando resumen y glosario";
        case "cards":
          return "Generando placas interactivas";
        case "simplified_facil":
          return "Escribiendo versión simple (fácil)";
        case "simplified_intermedio":
          return "Escribiendo versión simple (intermedio)";
        default:
          return "Generando material de estudio";
      }
    case "ready":
      return "Listo";
    case "error":
      return "Falló el procesamiento";
    default:
      return "Pendiente";
  }
}

export function isInProgressStatus(status: RecordingStatus | null | undefined): boolean {
  return status === "uploaded" || status === "transcribing" || status === "processing" || status === "generating";
}

// ---------------------------------------------------------------------------
// Bucle cliente: POST /api/recordings/{id}/step hasta done, con backoff.
// ---------------------------------------------------------------------------

export class PipelineStepError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number | null,
    public readonly last?: StepResponse | null,
  ) {
    super(message);
    this.name = "PipelineStepError";
  }
}

export interface RunPipelineOptions {
  onStep?: (res: StepResponse) => void;
  /** Reintentos consecutivos ante 5xx / red antes de abandonar (default 5). */
  maxRetries?: number;
  signal?: AbortSignal;
  /** Tope de pasos por corrida (protección contra bucles; default 400). */
  maxSteps?: number;
  fetchImpl?: typeof fetch;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new PipelineStepError("Proceso cancelado.", null));
      },
      { once: true },
    );
  });
}

/** Backoff exponencial con jitter: 1,5 s · 2^n (máx 30 s). */
export function backoffMs(attempt: number): number {
  const base = Math.min(30_000, 1_500 * 2 ** attempt);
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

/**
 * Avanza el pipeline hasta `done`. Cada POST ejecuta un solo paso en el servidor.
 * - 5xx o error de red → reintenta con backoff hasta `maxRetries` seguidos.
 * - 4xx → aborta (permiso, grabación inexistente, etc.).
 * - `status: 'error'` del servidor cuenta como fallo reintentable (el paso es idempotente).
 */
export async function runPipeline(recordingId: string, opts: RunPipelineOptions = {}): Promise<StepResponse> {
  const { onStep, signal } = opts;
  const maxRetries = opts.maxRetries ?? 5;
  const maxSteps = opts.maxSteps ?? 400;
  const doFetch = opts.fetchImpl ?? fetch;

  let consecutiveFailures = 0;
  let last: StepResponse | null = null;

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) throw new PipelineStepError("Proceso cancelado.", null, last);

    let res: Response;
    try {
      res = await doFetch(`/api/recordings/${recordingId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
      });
    } catch {
      if (signal?.aborted) throw new PipelineStepError("Proceso cancelado.", null, last);
      consecutiveFailures++;
      if (consecutiveFailures > maxRetries) {
        throw new PipelineStepError("Sin conexión con el servidor. Verificá tu internet y reintentá.", null, last);
      }
      await wait(backoffMs(consecutiveFailures - 1), signal);
      continue;
    }

    let body: Partial<StepResponse> & { error?: string } = {};
    try {
      body = (await res.json()) as Partial<StepResponse> & { error?: string };
    } catch {
      body = {};
    }

    if (res.status >= 400 && res.status < 500) {
      throw new PipelineStepError(body.error ?? `El servidor rechazó el pedido (HTTP ${res.status}).`, res.status, last);
    }

    if (!res.ok) {
      consecutiveFailures++;
      if (body.status) {
        last = normalize(body);
        onStep?.(last);
      }
      if (consecutiveFailures > maxRetries) {
        throw new PipelineStepError(
          body.error ?? `El procesamiento falló ${consecutiveFailures} veces seguidas.`,
          res.status,
          last,
        );
      }
      await wait(backoffMs(consecutiveFailures - 1), signal);
      continue;
    }

    consecutiveFailures = 0;
    last = normalize(body);
    onStep?.(last);
    if (last.done) return last;
    // Pequeña pausa para no martillar el servidor entre pasos.
    await wait(250, signal);
  }

  throw new PipelineStepError("Se alcanzó el máximo de pasos sin terminar. Reintentá más tarde.", null, last);
}

function normalize(b: Partial<StepResponse>): StepResponse {
  return {
    status: b.status ?? "error",
    progress: typeof b.progress === "number" ? b.progress : 0,
    current_step: b.current_step ?? null,
    chunks_done: b.chunks_done ?? 0,
    chunks_total: b.chunks_total ?? 0,
    done: Boolean(b.done),
    error: b.error,
  };
}
