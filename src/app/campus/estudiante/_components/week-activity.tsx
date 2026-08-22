"use client";

import { motion } from "motion/react";
import { Activity, Flame } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DayActivity } from "./student-data";

export function WeekActivity({ days, streak, total }: { days: DayActivity[]; streak: number; total: number }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <CardTitle eyebrow="Tu semana en el campus">
          {total === 0 ? "Arrancá hoy" : `${activeDays} de 7 días activos`}
        </CardTitle>
        <Activity className="size-4 text-accent-2" aria-hidden />
      </div>

      <div className="flex flex-1 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Actividad de los últimos 7 días: ${total} acciones`}>
        {days.map((d, i) => {
          const h = d.count === 0 ? 6 : Math.max(14, Math.round((d.count / max) * 88));
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center">
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: h, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  title={`${d.label}: ${d.count} ${d.count === 1 ? "acción" : "acciones"}`}
                  className={cn(
                    "w-full max-w-9 rounded-md",
                    d.count === 0 ? "bg-surface-2" : d.isToday ? "bg-accent-2 glow-2" : "bg-accent/80",
                  )}
                />
              </div>
              <span className={cn("font-mono text-[10px] uppercase tracking-wider", d.isToday ? "text-accent-2" : "text-muted")}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Flame className={cn("size-3.5", streak >= 2 ? "text-accent-3" : "text-muted")} aria-hidden />
          {streak >= 2 ? `Racha de ${streak} días` : streak === 1 ? "Primer día de la racha" : "Sin racha activa"}
        </span>
        <span className="font-mono tabular-nums">{total} acciones</span>
      </div>
    </Card>
  );
}
