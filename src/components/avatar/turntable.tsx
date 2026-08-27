"use client";

import * as React from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { OperatorAvatar, type AvatarConfig } from "./operator-avatar";
import { cn } from "@/lib/utils";

/**
 * Plataforma giratoria: se arrastra sobre el muñeco para verlo desde cualquier
 * ángulo, o se usan los botones para girar de a cuartos. Funciona con el dedo
 * (es lo que van a usar) y con teclado.
 */

const SNAP = 45;

export function Turntable({
  config,
  size = 300,
  ghostSlot = null,
  emoteClass = null,
  className,
  title,
}: {
  config: AvatarConfig;
  size?: number;
  ghostSlot?: string | null;
  emoteClass?: string | null;
  className?: string;
  title?: string;
}) {
  const [angle, setAngle] = React.useState(0);
  const drag = React.useRef<{ startX: number; startAngle: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startAngle: angle, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 4) return;
    d.moved = true;
    // Media pantalla de arrastre ≈ media vuelta: gira parejo sin marearse.
    setAngle(d.startAngle + (dx / (size * 0.55)) * 180);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    // Al soltar, se acomoda al ángulo notable más cercano.
    if (d?.moved) setAngle((a) => Math.round(a / SNAP) * SNAP);
  };

  const turn = (dir: -1 | 1) => setAngle((a) => Math.round(a / 90) * 90 + dir * 90);

  const facing = (() => {
    const n = ((Math.round(angle / 45) * 45) % 360 + 360) % 360;
    if (n === 0) return "De frente";
    if (n === 180) return "De espaldas";
    if (n === 90 || n === 135 || n === 45) return "De perfil";
    return "De perfil";
  })();

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Girar el operador"
        aria-valuenow={Math.round(((angle % 360) + 360) % 360)}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuetext={facing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setAngle((a) => a - SNAP);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setAngle((a) => a + SNAP);
          }
        }}
        className="w-full max-w-[320px] cursor-ew-resize touch-none rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <OperatorAvatar
          config={config}
          size={size}
          angle={angle}
          ghostSlot={ghostSlot}
          emoteClass={emoteClass}
          className="h-auto w-full"
          title={title}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => turn(-1)}
          aria-label="Girar a la izquierda"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-2/60 text-muted transition hover:border-accent/50 hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </button>
        <span className="min-w-[92px] text-center font-mono text-[11px] uppercase tracking-widest text-muted">
          {facing}
        </span>
        <button
          type="button"
          onClick={() => turn(1)}
          aria-label="Girar a la derecha"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-2/60 text-muted transition hover:border-accent/50 hover:text-foreground"
        >
          <RotateCw className="size-4" />
        </button>
      </div>
      <p className="text-[11px] text-muted">Arrastrá sobre el muñeco para girarlo.</p>
    </div>
  );
}
