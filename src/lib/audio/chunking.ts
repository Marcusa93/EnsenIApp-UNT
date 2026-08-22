/**
 * Particionado puro de una pista de audio en chunks de duración máxima fija.
 * Sin dependencias del DOM: testeable en Node.
 */

export const TARGET_SAMPLE_RATE = 16_000;
export const TARGET_BITRATE_KBPS = 32;
/** Máximo por chunk (10 min). Whisper acepta hasta 25 MB; a 32 kbps, 10 min ≈ 2,4 MB. */
export const MAX_CHUNK_SECONDS = 600;

export interface ChunkPlan {
  index: number;
  startSeconds: number;
  durationSeconds: number;
  /** Índice de la primera muestra (inclusive) */
  startSample: number;
  /** Índice de la última muestra (exclusive) */
  endSample: number;
}

/**
 * Divide `totalSamples` muestras a `sampleRate` Hz en chunks de ≤ `chunkSeconds`.
 * Reparte de forma pareja: en vez de N chunks llenos + uno minúsculo, usa
 * ceil(total / max) chunks de duración similar (evita un último chunk de 3 s).
 */
export function planChunks(
  totalSamples: number,
  sampleRate: number = TARGET_SAMPLE_RATE,
  chunkSeconds: number = MAX_CHUNK_SECONDS,
): ChunkPlan[] {
  if (!Number.isFinite(totalSamples) || totalSamples <= 0) return [];
  if (sampleRate <= 0 || chunkSeconds <= 0) throw new Error("sampleRate y chunkSeconds deben ser positivos.");

  const maxSamplesPerChunk = Math.floor(chunkSeconds * sampleRate);
  const count = Math.max(1, Math.ceil(totalSamples / maxSamplesPerChunk));
  const perChunk = Math.ceil(totalSamples / count);

  const plans: ChunkPlan[] = [];
  for (let i = 0; i < count; i++) {
    const startSample = i * perChunk;
    const endSample = Math.min(totalSamples, startSample + perChunk);
    if (endSample <= startSample) break;
    plans.push({
      index: i,
      startSample,
      endSample,
      startSeconds: round3(startSample / sampleRate),
      durationSeconds: round3((endSample - startSample) / sampleRate),
    });
  }
  return plans;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Estimación de bytes MP3 resultantes (para mostrar "de X MB a Y MB" antes de terminar). */
export function estimateMp3Bytes(seconds: number, kbps: number = TARGET_BITRATE_KBPS): number {
  return Math.round((seconds * kbps * 1000) / 8);
}
