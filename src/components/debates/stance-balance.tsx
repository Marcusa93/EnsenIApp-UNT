import { cn } from "@/lib/utils";
import { STANCES, STANCE_META, totalCounts, type StanceCounts } from "./stance";

export interface StanceBalanceProps {
  counts: StanceCounts;
  /** Muestra la leyenda con los números debajo de la barra */
  legend?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Mini barra de balance de posturas: a favor / en contra / neutral. Server-safe. */
export function StanceBalance({ counts, legend = true, size = "sm", className }: StanceBalanceProps) {
  const total = totalCounts(counts);
  const label = total
    ? `${counts.a_favor} a favor, ${counts.en_contra} en contra, ${counts.neutral} neutrales`
    : "Sin argumentos todavía";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="img"
        aria-label={label}
        className={cn(
          "flex w-full overflow-hidden rounded-full bg-surface-2",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
      >
        {total === 0 ? (
          <div className="h-full w-full bg-border/60" />
        ) : (
          STANCES.map((s) => {
            const pct = (counts[s] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={s}
                className={cn("h-full transition-[width] duration-500 ease-out", STANCE_META[s].bar)}
                style={{ width: `${pct}%` }}
              />
            );
          })
        )}
      </div>
      {legend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted">
          {STANCES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block size-1.5 rounded-full", STANCE_META[s].bar)} aria-hidden />
              <span className={STANCE_META[s].text}>{counts[s]}</span> {STANCE_META[s].short}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
