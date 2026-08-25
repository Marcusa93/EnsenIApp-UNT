/**
 * Cliente: decodifica un archivo de audio/video, lo lleva a mono 16 kHz,
 * lo codifica a MP3 32 kbps (en Web Worker, con fallback en main thread)
 * y lo parte en chunks de ≤ 10 min listos para subir.
 */
import {
  MAX_CHUNK_SECONDS,
  TARGET_BITRATE_KBPS,
  TARGET_SAMPLE_RATE,
  planChunks,
  round3,
  type ChunkPlan,
} from "./chunking";
import type { EncodeRequest, EncodeResponse } from "./compress.worker";

export type PreparePhase = "decoding" | "resampling" | "compressing";

export interface PrepareProgress {
  phase: PreparePhase;
  /** 0-100 dentro de la fase (decoding/resampling son indeterminadas → 0) */
  percent: number;
  /** Chunk en curso (sólo en compressing) */
  chunkIndex?: number;
  chunksTotal?: number;
}

export interface PreparedChunk {
  blob: Blob;
  index: number;
  startSeconds: number;
  durationSeconds: number;
}

export interface PreparedAudio {
  chunks: PreparedChunk[];
  totalDurationSeconds: number;
  originalBytes: number;
  compressedBytes: number;
  /** true si la codificación corrió en Web Worker; false si cayó al main thread */
  usedWorker: boolean;
}

export interface PrepareOptions {
  onProgress?: (p: PrepareProgress) => void;
  chunkSeconds?: number;
  signal?: AbortSignal;
}

export class AudioPrepareError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AudioPrepareError";
  }
}

const ACCEPTED_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "webm", "ogg", "oga", "opus", "mp4", "mov", "flac", "wma"];

export function isLikelyMediaFile(file: File): boolean {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AudioPrepareError("Proceso cancelado.");
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor {
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new AudioPrepareError("Este navegador no soporta Web Audio. Probá con Chrome, Edge, Firefox o Safari actualizados.");
  return Ctor;
}

async function decodeFile(file: File, signal?: AbortSignal): Promise<AudioBuffer> {
  const Ctor = getAudioContextCtor();
  const ctx = new Ctor();
  try {
    const arrayBuffer = await file.arrayBuffer();
    throwIfAborted(signal);
    // Safari viejo usa la firma con callbacks; envolvemos en Promise para cubrir ambos.
    const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (maybePromise && typeof (maybePromise as Promise<AudioBuffer>).then === "function") {
        (maybePromise as Promise<AudioBuffer>).then(resolve, reject);
      }
    });
    return decoded;
  } catch (err) {
    if (err instanceof AudioPrepareError) throw err;
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    throw new AudioPrepareError(
      isVideo
        ? "No pudimos extraer el audio de este video en el navegador. Probá convertirlo a MP3 o M4A (por ejemplo con VLC o un conversor online) y volvé a subirlo."
        : "No pudimos decodificar este archivo. Verificá que sea un audio válido (MP3, M4A, WAV, WebM u OGG) y que no esté dañado.",
      err,
    );
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

/**
 * Presupuesto de memoria para el PCM decodificado (duración × canales × sample rate × 4 bytes).
 * Por encima de esto la pestaña casi seguro muere durante el resample/compresión, incluso en desktop.
 */
const MAX_DECODED_BYTES = 3 * 1024 * 1024 * 1024;

/**
 * Decodifica y convierte a mono 16 kHz en un solo paso, sin exponer el AudioBuffer
 * al scope llamador: así el PCM decodificado (que para una clase de 2-3 h puede ocupar
 * varios GB) queda colectable por el GC antes de la fase de compresión.
 */
async function decodeToMono16k(file: File, opts: PrepareOptions): Promise<Float32Array> {
  const { onProgress, signal } = opts;
  onProgress?.({ phase: "decoding", percent: 0 });
  const decoded = await decodeFile(file, signal);

  const decodedBytes = decoded.length * decoded.numberOfChannels * 4;
  if (decodedBytes > MAX_DECODED_BYTES) {
    const gb = (decodedBytes / 1024 ** 3).toFixed(1);
    const hours = (decoded.duration / 3600).toFixed(1);
    throw new AudioPrepareError(
      `El audio decodificado ocupa ~${gb} GB en memoria (${hours} h, ${decoded.numberOfChannels === 1 ? "1 canal" : `${decoded.numberOfChannels} canales`} a ${Math.round(decoded.sampleRate / 100) / 10} kHz): es demasiado para procesarlo en el navegador. Convertí el archivo a MP3 mono (por ejemplo con VLC o un conversor online) o partilo en dos y subí cada parte.`,
    );
  }

  onProgress?.({ phase: "resampling", percent: 0 });
  return toMono16k(decoded, signal);
}

/** Downmix a mono + resample a 16 kHz con OfflineAudioContext. */
async function toMono16k(buffer: AudioBuffer, signal?: AbortSignal): Promise<Float32Array> {
  throwIfAborted(signal);
  const length = Math.ceil(buffer.duration * TARGET_SAMPLE_RATE);
  if (length <= 0) throw new AudioPrepareError("El archivo no contiene audio (duración 0).");

  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  throwIfAborted(signal);
  return rendered.getChannelData(0);
}

interface Encoder {
  encode(id: number, samples: Float32Array, onProgress: (processed: number, total: number) => void): Promise<Uint8Array>;
  dispose(): void;
  usedWorker: boolean;
}

function createWorkerEncoder(): Encoder | null {
  if (typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./compress.worker.ts", import.meta.url));
  } catch (err) {
    console.warn("[audio] no se pudo crear el Web Worker; usando main thread", err);
    return null;
  }

  const pending = new Map<
    number,
    { resolve: (b: Uint8Array) => void; reject: (e: Error) => void; onProgress: (p: number, t: number) => void }
  >();

  worker.addEventListener("message", (ev: MessageEvent<EncodeResponse>) => {
    const msg = ev.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === "progress") job.onProgress(msg.processed, msg.total);
    else if (msg.type === "done") {
      pending.delete(msg.id);
      job.resolve(msg.mp3);
    } else if (msg.type === "error") {
      pending.delete(msg.id);
      job.reject(new Error(msg.message));
    }
  });
  worker.addEventListener("error", (ev) => {
    const err = new Error(ev.message || "El Web Worker de compresión falló.");
    for (const job of pending.values()) job.reject(err);
    pending.clear();
  });
  worker.addEventListener("messageerror", () => {
    const err = new Error("El Web Worker de compresión envió un mensaje ilegible.");
    for (const job of pending.values()) job.reject(err);
    pending.clear();
  });

  /** Si el SO mata el worker (OOM) puede no llegar ningún evento: sin watchdog la promesa queda colgada. */
  const WATCHDOG_MS = 30_000;

  return {
    usedWorker: true,
    encode(id, samples, onProgress) {
      return new Promise<Uint8Array>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const arm = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error("El Web Worker de compresión dejó de responder (posible falta de memoria)."));
          }, WATCHDOG_MS);
        };
        pending.set(id, {
          resolve: (b) => {
            clearTimeout(timer);
            resolve(b);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
          onProgress: (p, t) => {
            arm();
            onProgress(p, t);
          },
        });
        arm();
        // Copiamos para transferir sin invalidar el buffer original (que puede ser una vista del AudioBuffer).
        const copy = new Float32Array(samples);
        const req: EncodeRequest = { type: "encode", id, samples: copy, sampleRate: TARGET_SAMPLE_RATE, kbps: TARGET_BITRATE_KBPS };
        worker.postMessage(req, [copy.buffer]);
      });
    },
    dispose() {
      worker.terminate();
    },
  };
}

async function createMainThreadEncoder(): Promise<Encoder> {
  const { encodeMono } = await import("./mp3-encode");
  return {
    usedWorker: false,
    encode(_id, samples, onProgress) {
      return encodeMono(samples, {
        sampleRate: TARGET_SAMPLE_RATE,
        kbps: TARGET_BITRATE_KBPS,
        onProgress,
        progressEvery: 32,
        yieldFn: () => new Promise((r) => setTimeout(r, 0)),
      });
    },
    dispose() {},
  };
}

/**
 * Pipeline completo en el navegador. Devuelve chunks MP3 con offsets exactos.
 * Lanza `AudioPrepareError` con mensajes útiles para el usuario.
 */
export async function prepareAudioChunks(file: File, opts: PrepareOptions = {}): Promise<PreparedAudio> {
  const { onProgress, signal } = opts;
  const chunkSeconds = opts.chunkSeconds ?? MAX_CHUNK_SECONDS;

  // Decode + resample en una función aparte: el AudioBuffer gigante no queda
  // referenciado en este scope durante toda la compresión.
  const mono = await decodeToMono16k(file, opts);

  const plans: ChunkPlan[] = planChunks(mono.length, TARGET_SAMPLE_RATE, chunkSeconds);
  const totalSamples = mono.length;
  const totalDurationSeconds = round3(totalSamples / TARGET_SAMPLE_RATE);

  let encoder: Encoder | null = createWorkerEncoder();
  let usedWorker = encoder !== null;
  if (!encoder) encoder = await createMainThreadEncoder();

  const chunks: PreparedChunk[] = [];
  let compressedBytes = 0;

  const encodeAll = async (enc: Encoder) => {
    for (const plan of plans) {
      throwIfAborted(signal);
      const slice = mono.subarray(plan.startSample, plan.endSample);
      const mp3 = await enc.encode(plan.index, slice, (processed) => {
        const done = plan.startSample + processed;
        onProgress?.({
          phase: "compressing",
          percent: Math.min(100, Math.round((done / totalSamples) * 100)),
          chunkIndex: plan.index,
          chunksTotal: plans.length,
        });
      });
      const blob = new Blob([mp3 as BlobPart], { type: "audio/mpeg" });
      compressedBytes += blob.size;
      chunks.push({ blob, index: plan.index, startSeconds: plan.startSeconds, durationSeconds: plan.durationSeconds });
    }
  };

  try {
    await encodeAll(encoder);
  } catch (err) {
    if (err instanceof AudioPrepareError) throw err;
    if (usedWorker) {
      // El worker falló (CSP, bundling, memoria): reintentamos en main thread desde cero.
      console.warn("[audio] worker falló; reintentando en main thread", err);
      encoder.dispose();
      chunks.length = 0;
      compressedBytes = 0;
      usedWorker = false;
      encoder = await createMainThreadEncoder();
      try {
        await encodeAll(encoder);
      } catch (err2) {
        throw new AudioPrepareError("No pudimos comprimir el audio en este navegador.", err2);
      }
    } else {
      throw new AudioPrepareError("No pudimos comprimir el audio en este navegador.", err);
    }
  } finally {
    encoder.dispose();
  }

  onProgress?.({ phase: "compressing", percent: 100, chunkIndex: plans.length - 1, chunksTotal: plans.length });

  return {
    chunks,
    totalDurationSeconds,
    originalBytes: file.size,
    compressedBytes,
    usedWorker,
  };
}
