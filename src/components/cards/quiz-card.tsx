"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, CircleHelp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

export interface QuizCardProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tag?: string;
  /** Opción elegida (null si todavía no respondió). */
  selected: number | null;
  onSelect: (index: number) => void;
  onContinue: () => void;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Pregunta de opción múltiple con feedback inmediato y explicación. */
export function QuizCard({ question, options, correctIndex, explanation, tag, selected, onSelect, onContinue }: QuizCardProps) {
  const answered = selected !== null;
  const isCorrect = answered && selected === correctIndex;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="mb-4 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-2 text-accent-2">
            <CircleHelp className="size-3.5" aria-hidden />
            Quiz
          </span>
          {tag && (
            <Badge size="sm" tone="muted">
              {tag}
            </Badge>
          )}
        </div>
        <p id="quiz-question" className="text-balance text-lg font-semibold leading-snug sm:text-xl">
          {question}
        </p>

        <div role="radiogroup" aria-labelledby="quiz-question" className="mt-5 flex flex-col gap-2.5">
          {options.map((opt, i) => {
            const chosen = selected === i;
            const correct = i === correctIndex;
            const state = !answered ? "idle" : correct ? "correct" : chosen ? "wrong" : "dim";
            return (
              <motion.button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={answered}
                onClick={() => onSelect(i)}
                whileTap={answered ? undefined : { scale: 0.985 }}
                animate={state === "wrong" ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
                  state === "idle" && "border-border bg-surface-2/40 hover:border-accent/60 hover:bg-surface-2",
                  state === "correct" && "border-success/60 bg-success/12 text-foreground",
                  state === "wrong" && "border-danger/60 bg-danger/12 text-foreground",
                  state === "dim" && "border-border opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[11px]",
                    state === "correct"
                      ? "border-success/60 bg-success/20 text-success"
                      : state === "wrong"
                        ? "border-danger/60 bg-danger/20 text-danger"
                        : "border-border bg-surface text-muted",
                  )}
                  aria-hidden
                >
                  {state === "correct" ? <Check className="size-3.5" /> : state === "wrong" ? <X className="size-3.5" /> : LETTERS[i]}
                </span>
                <span className="flex-1 leading-relaxed">{opt}</span>
                {!answered && i < 4 && <Kbd className="hidden sm:inline-flex">{i + 1}</Kbd>}
              </motion.button>
            );
          })}
        </div>
      </div>

      {answered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-2xl border p-4 sm:p-5",
            isCorrect ? "border-success/40 bg-success/8" : "border-danger/40 bg-danger/8",
          )}
        >
          <p className={cn("eyebrow mb-2", isCorrect ? "text-success" : "text-danger")}>
            {isCorrect ? "Correcto" : `Incorrecto · la respuesta era ${LETTERS[correctIndex]}`}
          </p>
          {explanation.trim() ? (
            <Markdown size="sm">{explanation}</Markdown>
          ) : (
            <p className="text-sm text-muted">
              {isCorrect ? "Bien ahí. Seguimos." : "Revisá el resumen de la clase para afianzar este punto."}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={onContinue} rightIcon={<ArrowRight />} autoFocus>
              Continuar
              <Kbd className="ml-1 hidden border-white/30 bg-white/10 text-white sm:inline-flex">→</Kbd>
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
