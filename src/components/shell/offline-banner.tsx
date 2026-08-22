"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { ensureAutoFlush, flush, getQueueSize, isOnline, subscribeQueue } from "@/lib/telemetry/offline-queue";
import { cn } from "@/lib/utils";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function subscribeQueueSize(cb: () => void) {
  return subscribeQueue(() => cb());
}

/**
 * Barra de estado de conexión + cola offline.
 * Placeholder de fundación: el módulo PWA la enriquece (service worker, cache de lectura).
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = React.useSyncExternalStore(subscribeOnline, isOnline, () => true);
  const pending = React.useSyncExternalStore(subscribeQueueSize, getQueueSize, () => 0);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);
  const prevPending = React.useRef(pending);

  React.useEffect(() => {
    ensureAutoFlush();
  }, []);

  // Cuando la cola pasa de N>0 a 0, mostramos "Todo sincronizado" un momento.
  React.useEffect(() => {
    const wasPending = prevPending.current > 0;
    prevPending.current = pending;
    if (!wasPending || pending !== 0) return;
    const show = window.setTimeout(() => setJustSynced(true), 0);
    const hide = window.setTimeout(() => setJustSynced(false), 2500);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [pending]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await flush();
    } finally {
      setSyncing(false);
    }
  };

  const show = !online || pending > 0 || justSynced;

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="offline-banner"
          role="status"
          aria-live="polite"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={cn("overflow-hidden", className)}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-b px-4 py-2 text-xs sm:px-6",
              !online
                ? "border-warning/30 bg-warning/10 text-warning"
                : justSynced && pending === 0
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-accent-2/30 bg-accent-2/10 text-accent-2",
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              {!online ? <CloudOff className="size-4 shrink-0" aria-hidden /> : <Wifi className="size-4 shrink-0" aria-hidden />}
              <span className="font-medium">
                {!online
                  ? "Sin conexión. Podés seguir leyendo; tus cambios se guardan en el dispositivo."
                  : justSynced && pending === 0
                    ? "Todo sincronizado."
                    : "Conexión recuperada."}
              </span>
              {pending > 0 && (
                <span className="font-mono uppercase tracking-widest opacity-80">
                  · {pending} {pending === 1 ? "cambio pendiente" : "cambios pendientes"} de sincronizar
                </span>
              )}
            </div>
            {online && pending > 0 && (
              <button
                type="button"
                onClick={syncNow}
                disabled={syncing}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-current/30 px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition hover:bg-current/10 disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", syncing && "animate-spin")} aria-hidden />
                Sincronizar
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
