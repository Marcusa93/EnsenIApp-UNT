"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, Wand2 } from "lucide-react";
import { Button, Card, Skeleton } from "@/components/ui";
import { track } from "@/lib/telemetry";

interface GenerateFeedbackButtonProps {
  /** ISO del último feedback (para el rate limit en cliente). */
  lastCreatedAt: string | null;
  hasData: boolean;
}

const MIN_INTERVAL_MS = 10 * 60 * 1000;

const TICK_MS = 15000;

function remainingMs(lastCreatedAt: string | null, now: number): number {
  if (!lastCreatedAt) return 0;
  return Math.max(0, MIN_INTERVAL_MS - (now - new Date(lastCreatedAt).getTime()));
}

function subscribeClock(onChange: () => void) {
  const id = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(id);
}
/** Snapshot estable por tick (evita re-renders infinitos). */
function getClockSnapshot() {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}
function getServerClockSnapshot() {
  return 0;
}

/**
 * Botón "Generar mi devolución": POST /api/feedback/generate, skeleton mientras la IA escribe
 * y refresh del Server Component (la lista de devoluciones muestra la nueva arriba).
 */
export function GenerateFeedbackButton({ lastCreatedAt, hasData }: GenerateFeedbackButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [isRefreshing, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  // Reloj externo (tick cada 15 s) para el cooldown; en SSR se asume "sin cooldown" y se corrige al hidratar.
  const now = React.useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
  const remaining = now === 0 ? 0 : remainingMs(lastCreatedAt, now);

  const busy = pending || isRefreshing;
  const cooldown = remaining > 0 && !busy;
  const waitMin = Math.ceil(remaining / 60000);

  async function generate() {
    if (busy) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/generate", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { feedback_md?: string; error?: string; id?: string };
      if (!res.ok || !body.feedback_md) {
        setError(body.error ?? "No pudimos generar tu devolución. Probá de nuevo en unos minutos.");
        return;
      }
      void track("feedback_generated", {
        entity_type: "ai_feedback",
        entity_id: body.id,
        metadata: { chars: body.feedback_md.length },
      });
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("[progreso] generate feedback", err);
      setError("No hay conexión con el servidor. Probá de nuevo cuando vuelva la red.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} loading={busy} disabled={cooldown} leftIcon={<Wand2 />} className="glow">
          {busy ? "Leyendo tu recorrido…" : lastCreatedAt ? "Generar una nueva devolución" : "Generar mi devolución"}
        </Button>
        <p className="text-xs text-muted" aria-live="polite">
          {cooldown
            ? `Podés pedir otra en ${waitMin} ${waitMin === 1 ? "minuto" : "minutos"}.`
            : hasData
              ? "Tarda unos 20 segundos. Usa tus check-ins, placas, entregas y consultas."
              : "Con poco uso la devolución va a ser general: usá el campus y volvé a generarla."}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {busy && (
          <motion.div key="skeleton" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-accent/30" role="status" aria-label="Generando tu devolución">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 animate-pulse text-accent" aria-hidden />
                <span className="eyebrow text-accent">La IA está escribiendo tu devolución</span>
              </div>
              <Skeleton lines={5} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
