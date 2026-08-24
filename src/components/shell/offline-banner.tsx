"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, LoaderCircle, RefreshCw, Wifi } from "lucide-react";
import { ensureAutoFlush, flush, getQueueSize, isOnline, subscribeQueue } from "@/lib/telemetry";
import { InstallPrompt } from "@/components/pwa/pwa-register";
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

type Phase = "offline" | "syncing" | "pending" | "synced" | "failed" | "hidden";

/**
 * Barra de estado de conexión + cola offline (localStorage `ensenia.offline-queue`).
 *
 * - Sin red: "Sin conexión · N cambios pendientes".
 * - Al volver la red con cola: "Sincronizando…" (flush automático) y luego "Todo sincronizado" unos segundos.
 * - Si el flush deja ítems (fallos de red): "N cambios pendientes" + botón "Reintentar".
 * - Debajo, cuando aplica, el prompt de instalación de la PWA (barra secundaria).
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = React.useSyncExternalStore(subscribeOnline, isOnline, () => true);
  const pending = React.useSyncExternalStore(subscribeQueueSize, getQueueSize, () => 0);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);
  const [lastFailed, setLastFailed] = React.useState(0);
  const prevOnline = React.useRef(online);
  const prevPending = React.useRef(pending);

  React.useEffect(() => {
    ensureAutoFlush();
  }, []);

  const sync = React.useCallback(async () => {
    if (!isOnline() || getQueueSize() === 0) return;
    setSyncing(true);
    try {
      const result = await flush();
      setLastFailed(result.failed);
    } catch (err) {
      console.error("[offline-banner] flush falló", err);
      setLastFailed(getQueueSize());
    } finally {
      setSyncing(false);
    }
  }, []);

  // Al recuperar conexión con cambios pendientes, sincronizamos de inmediato.
  React.useEffect(() => {
    const wasOffline = !prevOnline.current;
    prevOnline.current = online;
    if (online && wasOffline && pending > 0) void sync();
  }, [online, pending, sync]);

  // Cuando la cola pasa de N>0 a 0, mostramos "Todo sincronizado" un momento.
  React.useEffect(() => {
    const wasPending = prevPending.current > 0;
    prevPending.current = pending;
    if (!wasPending || pending !== 0) return;
    setLastFailed(0);
    const show = window.setTimeout(() => setJustSynced(true), 0);
    const hide = window.setTimeout(() => setJustSynced(false), 3000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [pending]);

  const phase: Phase = !online
    ? "offline"
    : syncing
      ? "syncing"
      : pending > 0
        ? lastFailed > 0
          ? "failed"
          : "pending"
        : justSynced
          ? "synced"
          : "hidden";

  const pendingLabel = `${pending} ${pending === 1 ? "cambio pendiente" : "cambios pendientes"}`;

  return (
    <>
      <AnimatePresence initial={false}>
        {phase !== "hidden" && (
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
                phase === "offline" && "border-warning/30 bg-warning/10 text-warning",
                phase === "syncing" && "border-accent-2/30 bg-accent-2/10 text-accent-2",
                phase === "pending" && "border-accent-2/30 bg-accent-2/10 text-accent-2",
                phase === "failed" && "border-danger/30 bg-danger/10 text-danger",
                phase === "synced" && "border-success/30 bg-success/10 text-success",
              )}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                {phase === "offline" ? (
                  <CloudOff className="size-4 shrink-0" aria-hidden />
                ) : phase === "syncing" ? (
                  <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Wifi className="size-4 shrink-0" aria-hidden />
                )}
                <span className="font-medium">
                  {phase === "offline" && "Sin conexión"}
                  {phase === "syncing" && "Sincronizando…"}
                  {phase === "pending" && "Conexión recuperada"}
                  {phase === "failed" && "No se pudieron enviar algunos cambios"}
                  {phase === "synced" && "Todo sincronizado"}
                </span>
                {pending > 0 && (
                  <span className="font-mono uppercase tracking-widest opacity-80">· {pendingLabel}</span>
                )}
                {phase === "offline" && (
                  <span className="hidden opacity-80 sm:inline">
                    · Podés seguir leyendo lo que ya abriste; tus cambios se guardan en el dispositivo.
                  </span>
                )}
              </div>
              {online && pending > 0 && !syncing && (
                <button
                  type="button"
                  onClick={() => void sync()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-current/30 px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <RefreshCw className="size-3" aria-hidden />
                  Reintentar
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <InstallPrompt variant="bar" />
    </>
  );
}
