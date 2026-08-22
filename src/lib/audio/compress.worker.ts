/**
 * Web Worker: codifica un chunk PCM mono (Float32Array) a MP3 sin bloquear la UI.
 * Protocolo:
 *   in : { type: "encode", id, samples: Float32Array, sampleRate, kbps }
 *   out: { type: "progress", id, processed, total } | { type: "done", id, mp3: Uint8Array } | { type: "error", id, message }
 */
import { encodeMono } from "./mp3-encode";

export interface EncodeRequest {
  type: "encode";
  id: number;
  samples: Float32Array;
  sampleRate: number;
  kbps: number;
}

export type EncodeResponse =
  | { type: "progress"; id: number; processed: number; total: number }
  | { type: "done"; id: number; mp3: Uint8Array }
  | { type: "error"; id: number; message: string };

interface WorkerScope {
  postMessage(message: EncodeResponse, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (ev: MessageEvent<EncodeRequest>) => void): void;
}

const scope = self as unknown as WorkerScope;

scope.addEventListener("message", async (ev) => {
  const msg = ev.data;
  if (!msg || msg.type !== "encode") return;
  try {
    const mp3 = await encodeMono(msg.samples, {
      sampleRate: msg.sampleRate,
      kbps: msg.kbps,
      progressEvery: 128,
      onProgress: (processed, total) => scope.postMessage({ type: "progress", id: msg.id, processed, total }),
    });
    scope.postMessage({ type: "done", id: msg.id, mp3 }, [mp3.buffer]);
  } catch (err) {
    scope.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : "Error desconocido al codificar MP3.",
    });
  }
});
