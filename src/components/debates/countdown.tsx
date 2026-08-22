"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s };
}

function describe(ms: number): string {
  const { d, h, m, s } = parts(ms);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s.toString().padStart(2, "0")} s`;
  return `${s} s`;
}

export interface CountdownProps {
  closesAt: string | null;
  /** Estado del debate: si no está abierto no tiene sentido contar */
  open: boolean;
  /** Se llama cuando el contador llega a cero (para deshabilitar el composer) */
  onExpire?: () => void;
  className?: string;
}

/** Cuenta regresiva al cierre. Se actualiza cada segundo sólo cuando falta menos de una hora. */
export function Countdown({ closesAt, open, onExpire, className }: CountdownProps) {
  const target = React.useMemo(() => (closesAt ? new Date(closesAt).getTime() : null), [closesAt]);
  const [now, setNow] = React.useState<number | null>(null);
  const expiredRef = React.useRef(false);

  React.useEffect(() => {
    if (!target || !open) return;
    setNow(Date.now());
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= target && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    const remaining = target - Date.now();
    const interval = remaining < 3_600_000 ? 1000 : 60_000;
    const id = window.setInterval(tick, interval);
    return () => window.clearInterval(id);
  }, [target, open, onExpire]);

  if (!closesAt || !target) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs text-muted", className)}>
        <Clock className="size-3.5" aria-hidden />
        Sin fecha de cierre
      </span>
    );
  }

  if (!open) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs text-muted", className)}>
        <Clock className="size-3.5" aria-hidden />
        Cerró el {formatDateTime(closesAt)}
      </span>
    );
  }

  const remaining = now === null ? null : target - now;
  const urgent = remaining !== null && remaining > 0 && remaining < 3_600_000;
  const done = remaining !== null && remaining <= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs tabular-nums",
        done ? "text-warning" : urgent ? "text-accent-3" : "text-muted",
        className,
      )}
      aria-live={urgent ? "polite" : undefined}
      title={`Cierra el ${formatDateTime(closesAt)}`}
    >
      <Clock className={cn("size-3.5", urgent && "animate-pulse")} aria-hidden />
      {remaining === null ? (
        <>Cierra el {formatDateTime(closesAt)}</>
      ) : done ? (
        <>Plazo vencido</>
      ) : (
        <>
          Cierra en <span className="text-foreground">{describe(remaining)}</span>
        </>
      )}
    </span>
  );
}
