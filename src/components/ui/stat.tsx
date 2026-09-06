import * as React from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Variación (número → ícono + signo; string → tal cual) */
  delta?: number | string;
  /** Texto secundario debajo del valor */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "accent" | "accent-2" | "accent-3" | "muted";
}

const toneText = {
  accent: "text-accent",
  "accent-2": "text-accent-2",
  "accent-3": "text-accent-3",
  muted: "text-muted",
} as const;

const toneRule = {
  accent: "bg-accent",
  "accent-2": "bg-accent-2",
  "accent-3": "bg-accent-3",
  muted: "bg-muted",
} as const;

/** Cifra protagonista en Montserrat extrabold con una pleca corta del tono. */
export function Stat({ label, value, delta, hint, icon, tone = "accent", className, ...props }: StatProps) {
  const deltaNum = typeof delta === "number" ? delta : null;
  const DeltaIcon = deltaNum === null ? null : deltaNum > 0 ? TrendingUp : deltaNum < 0 ? TrendingDown : Minus;
  const deltaTone =
    deltaNum === null ? "text-muted" : deltaNum > 0 ? "text-success" : deltaNum < 0 ? "text-danger" : "text-muted";

  return (
    <div
      className={cn(
        "paper group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40",
        className,
      )}
      {...props}
    >
      <div
        className="trama trama-fade-r pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-60"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow">{label}</span>
        {icon && <span className={cn("[&>svg]:size-4", toneText[tone])}>{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="display-num text-3xl sm:text-4xl">{value}</span>
        {delta !== undefined && (
          <span className={cn("inline-flex items-center gap-1 font-mono text-xs tabular-nums", deltaTone)}>
            {DeltaIcon && <DeltaIcon className="size-3.5" aria-hidden />}
            {deltaNum !== null ? `${deltaNum > 0 ? "+" : ""}${deltaNum}` : delta}
          </span>
        )}
      </div>
      <span className={cn("mt-2.5 block h-0.5 w-8 rounded-full", toneRule[tone])} aria-hidden />
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
