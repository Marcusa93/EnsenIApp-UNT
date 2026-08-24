"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, CircleHelp, RotateCcw, Sparkles, Target, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import type { SessionStats } from "./types";

export interface SessionSummaryProps {
  stats: SessionStats;
  classId: string;
  classTopic: string;
  /** Placas conocidas acumuladas (todas las sesiones) sobre el total. */
  knownTotal: number;
  cardsTotal: number;
  onReviewMissed: () => void;
  onRestartAll: () => void;
  /** Escritura pendiente / encolada offline. */
  syncNote?: string | null;
}

function headline(ratio: number): { title: string; sub: string } {
  if (ratio >= 0.9) return { title: "Impecable", sub: "Dominás esta clase. Volvé en unos días para fijarla." };
  if (ratio >= 0.7) return { title: "Muy bien", sub: "Te quedan pocos puntos por afianzar." };
  if (ratio >= 0.4) return { title: "Buen avance", sub: "Repasá las que marcaste y volvé a intentar." };
  return { title: "Primer contacto", sub: "Es normal: leé el resumen y volvé a las placas." };
}

/** Pantalla de cierre de una sesión de placas: resultados, tags débiles y acciones. */
export function SessionSummary({
  stats,
  classId,
  classTopic,
  knownTotal,
  cardsTotal,
  onReviewMissed,
  onRestartAll,
  syncNote,
}: SessionSummaryProps) {
  const ratio = stats.total > 0 ? stats.known / stats.total : 0;
  const pct = Math.round(ratio * 100);
  const { title, sub } = headline(ratio);
  const quizPct = stats.quizTotal > 0 ? Math.round((stats.quizCorrect / stats.quizTotal) * 100) : null;
  const tone = ratio >= 0.7 ? "success" : ratio >= 0.4 ? "accent" : "warning";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="session-summary-title"
      className="flex flex-col gap-5"
    >
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 text-center sm:p-8">
        <div className="campus-grid campus-grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className={cn("pointer-events-none absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full blur-3xl", tone === "success" ? "bg-success/20" : tone === "accent" ? "bg-accent/25" : "bg-warning/20")} aria-hidden />
        <div className="relative flex flex-col items-center gap-4">
          <ProgressRing value={pct} size={112} strokeWidth={8} tone={tone} label={`${stats.known} de ${stats.total} placas conocidas`}>
            <span className="flex flex-col items-center leading-none">
              <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">sesión</span>
            </span>
          </ProgressRing>
          <div>
            <p className="eyebrow mb-1 flex items-center justify-center gap-2 text-accent-2">
              <Trophy className="size-3.5" aria-hidden />
              Sesión terminada
            </p>
            <h2 id="session-summary-title" className="text-2xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{sub}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Conocidas"
          value={`${stats.known}/${stats.total}`}
          hint="en esta sesión"
          icon={<Sparkles />}
          tone="accent"
        />
        <Stat
          label="Quiz"
          value={quizPct == null ? "—" : `${stats.quizCorrect}/${stats.quizTotal}`}
          hint={quizPct == null ? "sin preguntas" : `${quizPct} % de aciertos`}
          icon={<CircleHelp />}
          tone="accent-2"
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
        <p className="eyebrow mb-1">Progreso total de la clase</p>
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{knownTotal}</span>
          <span className="text-muted"> de {cardsTotal} placas marcadas como conocidas · {classTopic}</span>
        </p>
      </div>

      {stats.weakTags.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/6 p-4">
          <p className="eyebrow mb-2 flex items-center gap-2 text-warning">
            <Target className="size-3.5" aria-hidden />
            Sugerencia de repaso
          </p>
          <p className="mb-3 text-sm text-muted">Estos temas concentraron las que te costaron. Volvé al resumen de la clase y buscá estas secciones.</p>
          <div className="flex flex-wrap gap-2">
            {stats.weakTags.map((t) => (
              <Badge key={t.tag} tone="warning">
                {t.tag} · {t.misses}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {syncNote && (
        <p role="status" className="text-center text-xs text-muted">
          {syncNote}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {stats.toReview.length > 0 && (
          <Button size="lg" className="flex-1" onClick={onReviewMissed} leftIcon={<RotateCcw />}>
            Repasar las que no sabía ({stats.toReview.length})
          </Button>
        )}
        <Button size="lg" variant={stats.toReview.length > 0 ? "secondary" : "primary"} className="flex-1" onClick={onRestartAll} leftIcon={<RotateCcw />}>
          Repasar todo
        </Button>
      </div>
      <Button asChild variant="ghost" leftIcon={<ArrowLeft />}>
        <Link href={`/campus/estudiante/clases/${classId}`}>Volver a la clase</Link>
      </Button>
    </motion.section>
  );
}
