"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Progress, type ProgressTone } from "@/components/ui/progress";
import { describeStep, type RecordingStatus } from "@/lib/audio/pipeline";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PipelineProgressProps {
  status: RecordingStatus;
  progress: number;
  currentStep: string | null;
  chunksDone: number;
  chunksTotal: number;
  /** true si este cliente está ejecutando el bucle de pasos ahora mismo. */
  running?: boolean;
  errorMessage?: string | null;
  /** Marca de tiempo (ms) y progreso al iniciar la corrida actual, para estimar lo que falta. */
  startedAt?: { at: number; progress: number } | null;
  className?: string;
  size?: "sm" | "md";
}

function useNow(active: boolean, everyMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return now;
}

/** Estimación simple: velocidad media de avance en la corrida actual. */
export function estimateRemainingSeconds(
  startedAt: { at: number; progress: number } | null | undefined,
  progress: number,
  now: number,
): number | null {
  if (!startedAt) return null;
  const gained = progress - startedAt.progress;
  const elapsed = (now - startedAt.at) / 1000;
  if (gained < 3 || elapsed < 5) return null;
  const rate = gained / elapsed; // % por segundo
  if (rate <= 0) return null;
  return Math.max(5, Math.round((100 - progress) / rate));
}

/** Barra + paso actual + tiempo estimado del pipeline de una grabación. */
export function PipelineProgress({
  status,
  progress,
  currentStep,
  chunksDone,
  chunksTotal,
  running,
  errorMessage,
  startedAt,
  className,
  size = "md",
}: PipelineProgressProps) {
  const now = useNow(Boolean(running));
  const eta = running ? estimateRemainingSeconds(startedAt, progress, now) : null;

  const tone: ProgressTone = status === "error" ? "danger" : status === "ready" ? "success" : "accent";
  const label = describeStep(status, currentStep);
  const chunkInfo =
    status === "transcribing" && chunksTotal > 0 ? `parte ${Math.min(chunksDone + 1, chunksTotal)} de ${chunksTotal}` : null;

  return (
    <div className={cn("flex flex-col gap-2", className)} aria-live="polite">
      <Progress value={status === "ready" ? 100 : progress} tone={tone} size={size} showValue indeterminate={false} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          {status === "error" ? (
            <AlertTriangle className="size-3.5 text-danger" aria-hidden />
          ) : status === "ready" ? (
            <CheckCircle2 className="size-3.5 text-success" aria-hidden />
          ) : running ? (
            <LoaderCircle className="size-3.5 animate-spin text-accent" aria-hidden />
          ) : (
            <span className="inline-block size-1.5 rounded-full bg-warning" aria-hidden />
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className={cn("font-medium", status === "error" ? "text-danger" : "text-foreground")}
            >
              {label}
            </motion.span>
          </AnimatePresence>
          {chunkInfo && <span className="font-mono text-[11px]">· {chunkInfo}</span>}
        </span>
        {!running && status !== "ready" && status !== "error" && (
          <span className="font-mono text-[11px] uppercase tracking-widest text-warning">pausado</span>
        )}
        {eta !== null && (
          <span className="font-mono text-[11px] tabular-nums">faltan ≈ {formatDuration(eta)}</span>
        )}
      </div>
      {status === "error" && errorMessage && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
