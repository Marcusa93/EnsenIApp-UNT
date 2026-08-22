"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { ensureAutoFlush, flush, getQueueSize, isOnline, subscribeQueue } from "@/lib/telemetry/offline-queue";
import { cn } from "@/lib/utils";

/**
 * Barra de estado de conexión + cola offline.
 * Placeholder de fundación: el módulo PWA la enriquece (service worker, cache de lectura).
 */
export function OfflineBanner({ className }: { className?: string }) {
  const [online, setOnline] = React.useState(true);
  const [pending, setPending] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);

  React.useEffect(() => {
    setOnline(isOnline());
    setPending(getQueueSize());
    ensureAutoFlush();
    const unsub = subscribeQueue((size) => {
      setPending((prev) => {
        if (prev > 0 && size === 0) {
          setJustSynced(true);
          window.setTimeout(() => setJustSynced(false), 2500);
        }
        return size;
      });
    });
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

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
            <div className="flex items-center gap-2">
              {!online ? <CloudOff className="size-4" aria-hidden /> : <Wifi className="size-4" aria-hidden />}
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition hover:bg-current/10 disabled:opacity-50"
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
