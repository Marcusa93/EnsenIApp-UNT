import type { Json } from "@/lib/types/database";

/**
 * Persistencia local de una actividad en curso, para resolverla sin datos.
 *
 * Dos piezas, las dos en localStorage y a prueba de storage bloqueado:
 *
 * - El ESPEJO del borrador: cada cambio de respuesta se escribe acá al
 *   instante, antes e independientemente del autosave por red. Si la pestaña
 *   se cierra sin señal, al reabrir (la página vive en el cache del service
 *   worker) las respuestas siguen donde estaban.
 * - La ENTREGA PENDIENTE: si el estudiante entrega sin conexión, el paquete
 *   queda acá y se envía solo al reconectar (evento `online` o próxima
 *   visita). La corrección sigue siendo del servidor: acá no viaja ninguna
 *   respuesta correcta, sólo lo que el estudiante contestó.
 */

const ESPEJO = (activityId: string) => `ensenia:borrador:${activityId}`;
const PENDIENTE = (activityId: string) => `ensenia:entrega-pendiente:${activityId}`;

export interface BorradorLocal {
  answers: Json;
  timeSpentSeconds: number;
  updatedAt: number;
}

export interface EntregaPendiente {
  answers: Json;
  timeSpentSeconds: number;
  queuedAt: number;
}

function leer<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function escribir(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage lleno o bloqueado: se sigue sin persistencia local, sin romper.
  }
}

function borrar(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ídem
  }
}

export const guardarBorradorLocal = (activityId: string, b: Omit<BorradorLocal, "updatedAt">) =>
  escribir(ESPEJO(activityId), { ...b, updatedAt: Date.now() } satisfies BorradorLocal);
export const leerBorradorLocal = (activityId: string) => leer<BorradorLocal>(ESPEJO(activityId));
export const borrarBorradorLocal = (activityId: string) => borrar(ESPEJO(activityId));

export const guardarEntregaPendiente = (activityId: string, e: Omit<EntregaPendiente, "queuedAt">) =>
  escribir(PENDIENTE(activityId), { ...e, queuedAt: Date.now() } satisfies EntregaPendiente);
export const leerEntregaPendiente = (activityId: string) => leer<EntregaPendiente>(PENDIENTE(activityId));
export const borrarEntregaPendiente = (activityId: string) => borrar(PENDIENTE(activityId));
