import * as React from "react";
import { cn, clamp } from "@/lib/utils";

export type ProgressTone = "accent" | "accent-2" | "accent-3" | "success" | "warning" | "danger";

const barTone: Record<ProgressTone, string> = {
  accent: "bg-accent",
  "accent-2": "bg-accent-2",
  "accent-3": "bg-accent-3",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const strokeTone: Record<ProgressTone, string> = {
  accent: "stroke-accent",
  "accent-2": "stroke-accent-2",
  "accent-3": "stroke-accent-3",
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
};

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  tone?: ProgressTone;
  label?: React.ReactNode;
  /** Muestra el porcentaje a la derecha del label */
  showValue?: boolean;
  size?: "sm" | "md";
  /** Animación de franjas para procesos en curso */
  indeterminate?: boolean;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, tone = "accent", label, showValue, size = "md", indeterminate, className, ...props },
  ref,
) {
  const v = clamp(Math.round(value), 0, 100);
  return (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && <span className="eyebrow">{label}</span>}
          {showValue && <span className="font-mono text-xs tabular-nums text-muted">{v} %</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : v}
        className={cn("w-full overflow-hidden rounded-full bg-surface-2", size === "sm" ? "h-1.5" : "h-2.5")}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            barTone[tone],
            indeterminate && "skeleton-shimmer w-1/2 animate-pulse",
          )}
          style={indeterminate ? undefined : { width: `${v}%` }}
        />
      </div>
    </div>
  );
});

export interface ProgressRingProps extends React.SVGAttributes<SVGSVGElement> {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: ProgressTone;
  /** Contenido centrado (p. ej. el porcentaje) */
  children?: React.ReactNode;
  label?: string;
}

export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  tone = "accent",
  children,
  label,
  className,
  ...props
}: ProgressRingProps) {
  const v = clamp(value, 0, 100);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label ?? `${Math.round(v)} %`}
        className={cn("-rotate-90", className)}
        {...props}
      >
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} className="fill-none stroke-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("fill-none transition-[stroke-dashoffset] duration-700 ease-out", strokeTone[tone])}
        />
      </svg>
      {children !== undefined ? (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs tabular-nums">
          {children}
        </span>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs tabular-nums">
          {Math.round(v)}%
        </span>
      )}
    </div>
  );
}
