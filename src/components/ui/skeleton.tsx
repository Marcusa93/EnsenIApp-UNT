import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Líneas de texto a simular (si se pasa, ignora children). */
  lines?: number;
}

export function Skeleton({ className, lines, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn("flex flex-col gap-2", className)} aria-hidden {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-3.5 rounded-md"
            style={{ width: i === lines - 1 ? "60%" : `${90 - (i % 3) * 8}%` }}
          />
        ))}
      </div>
    );
  }
  return <div className={cn("skeleton-shimmer rounded-xl", className)} aria-hidden {...props} />;
}

/** Esqueleto de tarjeta estándar (título + 3 líneas). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-5", className)} aria-hidden>
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-4 h-5 w-2/3" />
      <Skeleton lines={3} />
    </div>
  );
}
