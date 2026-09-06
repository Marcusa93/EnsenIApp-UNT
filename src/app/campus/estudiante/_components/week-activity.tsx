"use client";

import { motion } from "motion/react";
import { Activity, Flame } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DayActivity } from "./student-data";

/** Actividad de los últimos 7 días: barras en tokens (hoy en verde petróleo, el color de los datos). */
export function WeekActivity({ days, streak, total }: { days: DayActivity[]; streak: number; total: number }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const activeDays = days.filter((d) => d.count > 0).length;
  const streakLabel =
    streak >= 2 ? `Racha de ${streak} días` : streak === 1 ? "Primer día de la racha" : "Sin racha activa";

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">Tu semana en el campus</span>
          <h3 className="mt-1 flex flex-wrap items-baseline gap-x-2 font-display font-bold leading-none tracking-tight">
            {total === 0 ? (
              <span className="text-base">Arrancá hoy</span>
            ) : (
              <>
                <span className="display-num text-3xl text-accent-2 sm:text-4xl">{activeDays}</span>
                <span className="text-sm font-semibold text-muted">de 7 días activos</span>
              </>
            )}
          </h3>
        </div>
        <Activity className="size-4 shrink-0 text-accent-2" aria-hidden />
      </div>

      <div
        className="flex flex-1 items-end gap-1.5 sm:gap-2"
        role="img"
        aria-label={`Actividad de los últimos 7 días: ${total} ${total === 1 ? "acción" : "acciones"}`}
      >
        {days.map((d, i) => {
          const h = d.count === 0 ? 6 : Math.max(14, Math.round((d.count / max) * 88));
          return (
            <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center">
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: h, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  title={`${d.label}: ${d.count} ${d.count === 1 ? "acción" : "acciones"}`}
                  className={cn(
                    "w-full max-w-9 rounded-md",
                    d.count === 0 ? "bg-border" : d.isToday ? "bg-accent-2" : "bg-accent/75",
                  )}
                />
              </div>
              <span
                className={cn(
                  "font-display text-[10px] font-bold uppercase tracking-[0.12em]",
                  d.isToday ? "text-accent-2" : "text-muted",
                )}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Flame className={cn("size-3.5 shrink-0", streak >= 2 ? "text-accent" : "text-muted")} aria-hidden />
          <span className="truncate">{streakLabel}</span>
        </span>
        <span className="shrink-0 font-mono tabular-nums">
          {total} {total === 1 ? "acción" : "acciones"}
        </span>
      </div>
    </Card>
  );
}
