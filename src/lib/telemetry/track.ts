"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UsageEventType } from "@/lib/types/helpers";
import type { TablesInsert } from "@/lib/types/helpers";
import {
  enqueue,
  ensureAutoFlush,
  flush,
  getQueueSize,
  isOnline,
  subscribeQueue,
} from "@/lib/telemetry/offline-queue";

export { getQueueSize, subscribeQueue, flush, ensureAutoFlush };

export interface TrackOptions {
  entity_type?: string;
  /** UUID de la entidad (clase, grabación, actividad...). */
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

let cachedUserId: string | null | undefined;

async function currentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  cachedUserId = session?.user.id ?? null;
  supabase.auth.onAuthStateChange((_event, s) => {
    cachedUserId = s?.user.id ?? null;
  });
  return cachedUserId;
}

function looksLikeNetworkError(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
  return /fetch|network|load failed|timeout|ECONN|abort/i.test(msg);
}

/**
 * Registra un evento de uso. Nunca lanza: si no hay sesión, lo ignora; si no hay red
 * o el insert falla por red, lo encola en localStorage.
 */
export async function track(event: UsageEventType, opts: TrackOptions = {}): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;

    const row: TablesInsert<"usage_events"> = {
      student_id: userId,
      event_type: event,
      entity_type: opts.entity_type ?? "app",
      entity_id: opts.entity_id ?? null,
      metadata: { ...(opts.metadata ?? {}), client_ts: new Date().toISOString() },
    };

    if (!isOnline()) {
      enqueue({ table: "usage_events", op: "insert", payload: row });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("usage_events").insert(row);
    if (error) {
      if (looksLikeNetworkError(error) || !error.code) {
        enqueue({ table: "usage_events", op: "insert", payload: row });
      } else {
        console.error("[track] insert rechazado", { event, error });
      }
    }
  } catch (err) {
    console.warn("[track] fallo inesperado; se encola", err);
    try {
      const userId = cachedUserId;
      if (userId) {
        enqueue({
          table: "usage_events",
          op: "insert",
          payload: {
            student_id: userId,
            event_type: event,
            entity_type: opts.entity_type ?? "app",
            entity_id: opts.entity_id ?? null,
            metadata: opts.metadata ?? {},
          },
        });
      }
    } catch {
      /* nada más que hacer */
    }
  }
}

/** Registra page_view al montar (una vez por ruta) y arranca el auto-flush de la cola. */
export function useTrackPageView(entity_type?: string, entity_id?: string): void {
  const pathname = usePathname();
  useEffect(() => {
    ensureAutoFlush();
    void track("page_view", {
      entity_type: entity_type ?? "route",
      entity_id,
      metadata: { path: pathname },
    });
  }, [pathname, entity_type, entity_id]);
}

/** Emite focus_lost / focus_gained (útil en placas y actividades para medir atención). */
export function useFocusTracking(entity_type: string, entity_id?: string): void {
  useEffect(() => {
    const onVisibility = () => {
      void track(document.visibilityState === "hidden" ? "focus_lost" : "focus_gained", {
        entity_type,
        entity_id,
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [entity_type, entity_id]);
}
