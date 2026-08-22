/**
 * Codificación MP3 mono con @breezystack/lamejs.
 * Compartida entre el Web Worker y el fallback en main thread.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

/** Tamaño de bloque recomendado por LAME (múltiplo de 576). */
const BLOCK_SIZE = 1152;

export interface EncodeOptions {
  sampleRate: number;
  kbps: number;
  /** Llamado cada ~`progressEvery` bloques con el índice de muestra procesado. */
  onProgress?: (processedSamples: number, totalSamples: number) => void;
  progressEvery?: number;
  /** Si se provee, se invoca periódicamente para ceder el hilo (fallback main thread). */
  yieldFn?: () => Promise<void>;
}

function floatToInt16(samples: Float32Array, from: number, to: number): Int16Array {
  const out = new Int16Array(to - from);
  for (let i = from, j = 0; i < to; i++, j++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Codifica PCM float32 mono → MP3 (Uint8Array). */
export async function encodeMono(samples: Float32Array, opts: EncodeOptions): Promise<Uint8Array> {
  const encoder = new Mp3Encoder(1, opts.sampleRate, opts.kbps);
  const parts: Uint8Array[] = [];
  let total = 0;
  const every = opts.progressEvery ?? 64;

  for (let i = 0, block = 0; i < samples.length; i += BLOCK_SIZE, block++) {
    const end = Math.min(samples.length, i + BLOCK_SIZE);
    const buf = encoder.encodeBuffer(floatToInt16(samples, i, end));
    if (buf.length > 0) {
      parts.push(buf);
      total += buf.length;
    }
    if (block % every === 0) {
      opts.onProgress?.(end, samples.length);
      if (opts.yieldFn) await opts.yieldFn();
    }
  }
  const tail = encoder.flush();
  if (tail.length > 0) {
    parts.push(tail);
    total += tail.length;
  }
  opts.onProgress?.(samples.length, samples.length);

  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
