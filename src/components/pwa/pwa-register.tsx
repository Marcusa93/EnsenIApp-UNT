"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Registro del service worker + prompt de instalación.
 *
 * - Registra /sw.js en producción (y en dev sólo si NEXT_PUBLIC_PWA_DEV=1; si no, desregistra SWs viejos).
 * - Escucha actualizaciones y muestra un toast "Nueva versión disponible — actualizar".
 * - Captura `beforeinstallprompt` en un store global para que <InstallPrompt/> pueda montarse en cualquier lado.
 */

// ---------------------------------------------------------------------------
// Store: evento beforeinstallprompt (global, sin contexto)
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALL_DISMISSED_KEY = "ensenia.install-dismissed-at";
const INSTALL_DISMISS_DAYS = 14;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const installListeners = new Set<() => void>();

function notifyInstall() {
  installListeners.forEach((l) => l());
}

function subscribeInstall(listener: () => void) {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < INSTALL_DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

// Store minúsculo para "descartado": permite leerlo con useSyncExternalStore sin setState en efectos.
const dismissedListeners = new Set<() => void>();
function subscribeDismissed(listener: () => void) {
  dismissedListeners.add(listener);
  return () => {
    dismissedListeners.delete(listener);
  };
}

/** Snapshot para useSyncExternalStore: "puede instalarse" */
function getCanInstall(): boolean {
  return deferredPrompt !== null && !installed && !isStandalone();
}

let installListenersBound = false;
function bindInstallListeners() {
  if (installListenersBound || typeof window === "undefined") return;
  installListenersBound = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notifyInstall();
  });
}

/** Hook público: { canInstall, install(), dismiss() } */
export function useInstallPrompt() {
  React.useEffect(bindInstallListeners, []);
  const canInstall = React.useSyncExternalStore(subscribeInstall, getCanInstall, () => false);
  // En el server se asume descartado (no se muestra nada); en el cliente se lee localStorage.
  const dismissed = React.useSyncExternalStore(subscribeDismissed, dismissedRecently, () => true);

  const install = React.useCallback(async () => {
    const evt = deferredPrompt;
    if (!evt) return "unavailable" as const;
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") installed = true;
      deferredPrompt = null;
      notifyInstall();
      return outcome;
    } catch (err) {
      console.error("[pwa] el prompt de instalación falló", err);
      return "dismissed" as const;
    }
  }, []);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      /* storage no disponible */
    }
    dismissedListeners.forEach((l) => l());
  }, []);

  return { canInstall: canInstall && !dismissed, install, dismiss };
}

// ---------------------------------------------------------------------------
// <InstallPrompt/>: botón discreto "Instalar app" (variant "bar" para el OfflineBanner)
// ---------------------------------------------------------------------------

export function InstallPrompt({ variant = "button", className }: { variant?: "button" | "bar"; className?: string }) {
  const { canInstall, install, dismiss } = useInstallPrompt();
  const [busy, setBusy] = React.useState(false);

  if (!canInstall) return null;

  const onInstall = async () => {
    setBusy(true);
    try {
      await install();
    } finally {
      setBusy(false);
    }
  };

  if (variant === "button") {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={onInstall}
        loading={busy}
        leftIcon={<Download />}
        className={className}
        aria-label="Instalar EnsenIA como aplicación"
      >
        Instalar app
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-accent/25 bg-accent/8 px-4 py-1.5 text-xs text-foreground sm:px-6",
        className,
      )}
      role="region"
      aria-label="Instalar aplicación"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="truncate">
          <span className="font-medium">Instalá EnsenIA</span>
          <span className="hidden text-muted sm:inline"> · acceso directo y lectura sin conexión</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onInstall}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-accent transition hover:bg-accent/25 disabled:opacity-50"
        >
          <Download className="size-3" aria-hidden />
          Instalar app
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="No mostrar por ahora"
          className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// <PwaRegister/>: registro del SW + toast de actualización
// ---------------------------------------------------------------------------

const PWA_ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PWA_DEV === "1";

function sendConfig(target: ServiceWorker | null | undefined) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!target || !supabaseUrl) return;
  try {
    target.postMessage({ type: "CONFIG", supabaseOrigin: new URL(supabaseUrl).origin });
  } catch (err) {
    console.warn("[pwa] no se pudo enviar la config al SW", err);
  }
}

export function PwaRegister() {
  const [updateReady, setUpdateReady] = React.useState(false);
  const [reloading, setReloading] = React.useState(false);
  const waitingRef = React.useRef<ServiceWorker | null>(null);
  const reloadingRef = React.useRef(false);

  React.useEffect(bindInstallListeners, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!PWA_ENABLED) {
      // En desarrollo sin flag: limpiamos cualquier SW previo para no servir caches viejos.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister())).catch(() => {});
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (reloadingRef.current) return;
      sendConfig(navigator.serviceWorker.controller);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      const { type } = data as { type?: string };
      if (type === "SW_ACTIVATED" && hadController) setUpdateReady(true);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        sendConfig(reg.active ?? navigator.serviceWorker.controller);

        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              waitingRef.current = worker;
              setUpdateReady(true);
            }
            if (worker.state === "activated") sendConfig(worker);
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingRef.current = reg.waiting;
          setUpdateReady(true);
        }
        watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing));

        // Chequeo periódico de updates (cada hora mientras la pestaña esté abierta).
        timer = window.setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.error("[pwa] no se pudo registrar el service worker", err);
      });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  const applyUpdate = () => {
    reloadingRef.current = true;
    setReloading(true);
    const waiting = waitingRef.current;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
      // Si el SW ya estaba activo (skipWaiting automático), el evento no va a llegar: recargamos igual.
      window.setTimeout(() => window.location.reload(), 1500);
    } else {
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {updateReady && (
        <motion.div
          key="sw-update"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="glass fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-accent-2/30 p-3 shadow-2xl lg:bottom-6"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-2/15 text-accent-2">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Nueva versión disponible</p>
              <p className="eyebrow mt-0.5 text-[10px]">Actualizá para tener lo último</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" onClick={applyUpdate} loading={reloading} leftIcon={<RefreshCw />}>
              Actualizar
            </Button>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Más tarde" onClick={() => setUpdateReady(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
