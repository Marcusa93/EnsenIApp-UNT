"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { getDueState } from "./model";

/** "vence en 2 d 4 h" / "venció hace 3 h", actualizado en vivo. */
export function Countdown({ dueAt, className }: { dueAt: string | null; className?: string }) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!dueAt) return;
    const remaining = new Date(dueAt).getTime() - Date.now();
    const interval = Math.abs(remaining) < 3600_000 ? 1000 : 60_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [dueAt]);

  if (!dueAt) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs text-muted", className)}>
        <Clock className="size-3.5" aria-hidden />
        Sin fecha límite
      </span>
    );
  }

  const state = getDueState(dueAt, now);
  const diff = new Date(dueAt).getTime() - now;
  const label = state === "overdue" ? `Venció hace ${humanize(-diff)}` : `Vence en ${humanize(diff)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs tabular-nums",
        state === "overdue" && "text-danger",
        state === "soon" && "text-warning",
        state === "open" && "text-muted",
        className,
      )}
      title={formatDateTime(dueAt)}
    >
      <Clock className="size-3.5" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

function humanize(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${sec} s`;
}
