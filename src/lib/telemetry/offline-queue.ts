"use client";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

/**
 * Cola offline genérica para escrituras resilientes (usage_events, card_progress,
 * student_checkins, etc.). Persiste en localStorage y se vacía al recuperar red.
 *
 * Uso:
 *   enqueue({ table: "card_progress", op: "upsert", payload, key: `cp:${recId}:${idx}`, onConflict: "student_id,recording_id,card_index" })
 *   flush()  // manual; también corre al volver "online", cada 30 s y al montar (ensureAutoFlush)
 */

export const QUEUE_STORAGE_KEY = "ensenia.offline-queue";
const MAX_ITEMS = 500;
const MAX_ATTEMPTS = 5;
const FLUSH_INTERVAL_MS = 30_000;

export type QueueTable = keyof Database["public"]["Tables"];

export interface QueueItemInput {
  table: QueueTable;
  op: "insert" | "upsert";
  payload: Record<string, unknown>;
  /** Clave de compactación: si llega otro item con la misma clave, reemplaza al anterior (último gana). */
  key?: string;
  /** Columnas de conflicto para upsert (ej. "student_id,recording_id,card_index"). */
  onConflict?: string;
}

export interface QueueItem extends QueueItemInput {
  id: string;
  created_at: string;
  attempts: number;
}

type Listener = (size: number) => void;

const listeners = new Set<Listener>();
let flushing = false;
let autoFlushStarted = false;
let memoryFallback: QueueItem[] = [];

function isBrowser() {
  return typeof window !== "undefined";
}

function read(): QueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return memoryFallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return memoryFallback;
  }
}

function write(items: QueueItem[]) {
  memoryFallback = items;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn("[offline-queue] no se pudo persistir la cola (¿storage lleno?)", err);
    }
  }
  notify(items.length);
}

function notify(size: number) {
  listeners.forEach((l) => {
    try {
      l(size);
    } catch (err) {
      console.error("[offline-queue] listener falló", err);
    }
  });
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isOnline(): boolean {
  if (!isBrowser()) return true;
  return navigator.onLine !== false;
}

export function getQueueSize(): number {
  return read().length;
}

export function getQueueItems(): QueueItem[] {
  return read();
}

/** Suscripción al tamaño de la cola. Devuelve la función para desuscribirse. */
export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Encola una escritura. Compacta por `key` y recorta a MAX_ITEMS (descarta los más viejos). */
export function enqueue(input: QueueItemInput): QueueItem {
  const items = read();
  const item: QueueItem = { ...input, id: uid(), created_at: new Date().toISOString(), attempts: 0 };
  const compacted = input.key ? items.filter((i) => !(i.table === input.table && i.key === input.key)) : items;
  compacted.push(item);
  if (compacted.length > MAX_ITEMS) compacted.splice(0, compacted.length - MAX_ITEMS);
  write(compacted);
  return item;
}

export function removeFromQueue(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearQueue() {
  write([]);
}

function looksLikeNetworkError(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
  return /fetch|network|load failed|timeout|ECONN|abort/i.test(msg);
}

async function send(item: QueueItem): Promise<{ ok: true } | { ok: false; permanent: boolean; error: unknown }> {
  const supabase = createClient();
  // El cliente tipado exige el Insert de cada tabla; la cola es genérica por diseño.
  const table = supabase.from(item.table);
  const res =
    item.op === "upsert"
      ? await table.upsert(item.payload as never, item.onConflict ? { onConflict: item.onConflict } : undefined)
      : await table.insert(item.payload as never);
  if (!res.error) return { ok: true };
  const permanent = !looksLikeNetworkError(res.error) && Boolean(res.error.code);
  return { ok: false, permanent, error: res.error };
}

export interface FlushResult {
  sent: number;
  failed: number;
  dropped: number;
  remaining: number;
}

/** Intenta enviar todo. Los errores de red se reintentan; los permanentes (RLS, schema) se descartan con log. */
export async function flush(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, dropped: 0, remaining: 0 };
  if (flushing || !isOnline()) {
    result.remaining = getQueueSize();
    return result;
  }
  flushing = true;
  try {
    const items = read();
    if (items.length === 0) return result;
    const keep: QueueItem[] = [];
    for (const item of items) {
      try {
        const r = await send(item);
        if (r.ok) {
          result.sent++;
          continue;
        }
        if (r.permanent || item.attempts + 1 >= MAX_ATTEMPTS) {
          console.error("[offline-queue] descartado", { table: item.table, op: item.op, error: r.error });
          result.dropped++;
          continue;
        }
        keep.push({ ...item, attempts: item.attempts + 1 });
        result.failed++;
      } catch (err) {
        // Excepción (p. ej. sin red a mitad del flush): conservar y cortar.
        console.warn("[offline-queue] flush interrumpido", err);
        keep.push({ ...item, attempts: item.attempts + 1 });
        result.failed++;
        const idx = items.indexOf(item);
        keep.push(...items.slice(idx + 1));
        break;
      }
    }
    write(keep);
    result.remaining = keep.length;
    return result;
  } finally {
    flushing = false;
  }
}

/** Arranca (una sola vez) el flush automático: al volver online, cada 30 s y ahora mismo. */
export function ensureAutoFlush(): void {
  if (!isBrowser() || autoFlushStarted) return;
  autoFlushStarted = true;
  window.addEventListener("online", () => {
    void flush();
  });
  window.setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
  // Sincroniza listeners con el estado persistido y vacía lo pendiente.
  notify(getQueueSize());
  void flush();
}
