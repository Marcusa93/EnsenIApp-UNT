import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Botón o link (ya estilizado) */
  action?: React.ReactNode;
  tone?: "accent" | "accent-2" | "accent-3" | "muted";
  compact?: boolean;
}

const toneClass = {
  accent: "text-accent bg-accent/10 border-accent/20",
  "accent-2": "text-accent-2 bg-accent-2/10 border-accent-2/20",
  "accent-3": "text-accent-3 bg-accent-3/10 border-accent-3/20",
  muted: "text-muted bg-surface-2 border-border",
} as const;

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  tone = "accent",
  compact,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "campus-grid campus-grid-fade flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-2xl border",
          compact ? "size-10" : "size-14",
          toneClass[tone],
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} aria-hidden />
      </div>
      <h3 className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
