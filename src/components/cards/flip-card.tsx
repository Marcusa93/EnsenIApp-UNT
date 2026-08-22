"use client";

import * as React from "react";
import { motion, useReducedMotion, type PanInfo } from "motion/react";
import { Check, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

export interface FlipCardProps {
  question: string;
  answer: string;
  tag?: string;
  flipped: boolean;
  onFlip: () => void;
  onMark: (known: boolean) => void;
}

const SWIPE_THRESHOLD = 90;

/** Flashcard con flip 3D (rotateY) y gestos: deslizar a la derecha = la sé, izquierda = repasar. */
export function FlipCard({ question, answer, tag, flipped, onFlip, onMark }: FlipCardProps) {
  const reduce = useReducedMotion();
  const [dragX, setDragX] = React.useState(0);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragX(0);
    if (!flipped) return;
    if (info.offset.x > SWIPE_THRESHOLD) onMark(true);
    else if (info.offset.x < -SWIPE_THRESHOLD) onMark(false);
  };

  const face =
    "absolute inset-0 flex flex-col rounded-3xl border p-5 sm:p-7 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative [perspective:1400px]">
        {/* Indicadores de swipe */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center transition-opacity",
            dragX < -30 ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        >
          <span className="rounded-full border border-warning/40 bg-warning/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-warning">
            Repasar
          </span>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-3 z-10 flex items-center transition-opacity",
            dragX > 30 ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        >
          <span className="rounded-full border border-success/40 bg-success/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-success">
            La sé
          </span>
        </div>

        <motion.div
          drag={flipped ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDrag={(_, info) => setDragX(info.offset.x)}
          onDragEnd={onDragEnd}
          whileDrag={{ scale: 1.02 }}
          className="relative h-[22rem] w-full cursor-grab touch-pan-y active:cursor-grabbing sm:h-[24rem]"
        >
          <motion.div
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            aria-label={flipped ? "Respuesta. Presioná espacio para volver a la pregunta." : "Pregunta. Presioná espacio o tocá para ver la respuesta."}
            onClick={onFlip}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onFlip();
              }
            }}
            animate={reduce ? { opacity: 1 } : { rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative size-full [transform-style:preserve-3d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring rounded-3xl"
          >
            {/* Frente */}
            <div
              className={cn(face, "border-border bg-surface", reduce && flipped && "invisible")}
              aria-hidden={flipped}
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow text-accent">Pregunta</span>
                {tag && (
                  <Badge size="sm" tone="muted">
                    {tag}
                  </Badge>
                )}
              </div>
              <div className="flex flex-1 items-center justify-center py-4 text-center">
                <p className="text-balance text-lg font-semibold leading-snug sm:text-2xl">{question}</p>
              </div>
              <p className="flex items-center justify-center gap-2 text-xs text-muted">
                <RotateCcw className="size-3.5" aria-hidden />
                Tocá para dar vuelta
                <Kbd className="hidden sm:inline-flex">espacio</Kbd>
              </p>
            </div>

            {/* Dorso */}
            <div
              className={cn(
                face,
                "border-accent/40 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_14%,var(--surface)),var(--surface))]",
                reduce ? (flipped ? "" : "invisible") : "[transform:rotateY(180deg)]",
              )}
              aria-hidden={!flipped}
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow text-accent-2">Respuesta</span>
                {tag && (
                  <Badge size="sm" tone="muted">
                    {tag}
                  </Badge>
                )}
              </div>
              <div className="flex flex-1 items-center justify-center overflow-y-auto py-4 text-center">
                <Markdown size="md" className="text-left sm:text-center">
                  {answer}
                </Markdown>
              </div>
              <p className="text-center text-xs text-muted">Deslizá o elegí abajo</p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          disabled={!flipped}
          onClick={() => onMark(false)}
          leftIcon={<X />}
          className="border-warning/40 text-warning hover:bg-warning/10 disabled:opacity-40"
        >
          Repasar
          <Kbd className="ml-1 hidden sm:inline-flex">←</Kbd>
        </Button>
        <Button
          size="lg"
          disabled={!flipped}
          onClick={() => onMark(true)}
          leftIcon={<Check />}
          className="disabled:opacity-40"
        >
          La sé
          <Kbd className="ml-1 hidden border-white/30 bg-white/10 text-white sm:inline-flex">→</Kbd>
        </Button>
      </div>
    </div>
  );
}
