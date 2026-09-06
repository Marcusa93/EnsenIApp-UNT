import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "accent" | "accent-2" | "accent-3" | "muted" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Puntito de estado a la izquierda (pulsa si `live`). */
  dot?: boolean;
  live?: boolean;
  size?: "sm" | "md";
}

const tones: Record<BadgeTone, string> = {
  accent: "border-accent/30 bg-accent/10 text-accent",
  "accent-2": "border-accent-2/30 bg-accent-2/10 text-accent-2",
  "accent-3": "border-accent-3/30 bg-accent-3/10 text-accent-3",
  muted: "border-border bg-surface-2 text-muted",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

const dotColor: Record<BadgeTone, string> = {
  accent: "bg-accent",
  "accent-2": "bg-accent-2",
  "accent-3": "bg-accent-3",
  muted: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Sello: etiqueta en Montserrat versalitas, esquinas apenas redondeadas (como un sello de expediente). */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone = "muted", dot, live, size = "md", children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-display font-bold uppercase tracking-[0.12em]",
        size === "sm" ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-1 text-[10.5px]",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="relative inline-flex size-1.5">
          {live && (
            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", dotColor[tone])} />
          )}
          <span className={cn("relative inline-flex size-1.5 rounded-full", dotColor[tone])} />
        </span>
      )}
      {children}
    </span>
  );
});
