"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/types/helpers";
import { emptyQuestion } from "./model";

export interface QuizEditorProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  disabled?: boolean;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizEditor({ questions, onChange, disabled }: QuizEditorProps) {
  const update = (idx: number, patch: Partial<QuizQuestion>) =>
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {questions.map((q, idx) => (
          <motion.fieldset
            key={q.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-border bg-surface-2/40 p-4"
            disabled={disabled}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <legend className="eyebrow">Pregunta {idx + 1}</legend>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Subir pregunta"
                  disabled={disabled || idx === 0}
                  onClick={() => move(idx, -1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Bajar pregunta"
                  disabled={disabled || idx === questions.length - 1}
                  onClick={() => move(idx, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-danger hover:text-danger"
                  aria-label="Eliminar pregunta"
                  disabled={disabled || questions.length <= 1}
                  onClick={() => onChange(questions.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <Textarea
              rows={2}
              placeholder="Enunciado de la pregunta"
              value={q.prompt}
              onChange={(e) => update(idx, { prompt: e.target.value })}
              aria-label={`Enunciado de la pregunta ${idx + 1}`}
              className="min-h-16"
            />

            <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Opciones (marcá la correcta)">
              {q.options.map((opt, oi) => {
                const correct = q.correct_index === oi;
                return (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={correct}
                      aria-label={`Marcar opción ${OPTION_LETTERS[oi]} como correcta`}
                      disabled={disabled}
                      onClick={() => update(idx, { correct_index: oi })}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        correct
                          ? "border-success bg-success/15 text-success"
                          : "border-border bg-surface text-muted hover:border-accent/50",
                      )}
                    >
                      {OPTION_LETTERS[oi]}
                    </button>
                    <Input
                      placeholder={`Opción ${OPTION_LETTERS[oi]}`}
                      value={opt}
                      onChange={(e) =>
                        update(idx, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })
                      }
                      aria-label={`Texto de la opción ${OPTION_LETTERS[oi]}`}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`Quitar opción ${OPTION_LETTERS[oi]}`}
                      disabled={disabled || q.options.length <= 2}
                      onClick={() => {
                        const options = q.options.filter((_, i) => i !== oi);
                        const correct_index =
                          q.correct_index === oi ? 0 : q.correct_index > oi ? q.correct_index - 1 : q.correct_index;
                        update(idx, { options, correct_index });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
              {q.options.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  leftIcon={<Plus />}
                  disabled={disabled}
                  onClick={() => update(idx, { options: [...q.options, ""] })}
                >
                  Agregar opción
                </Button>
              )}
            </div>

            <Textarea
              rows={2}
              className="mt-3 min-h-14"
              placeholder="Explicación (se muestra al estudiante después de entregar)"
              value={q.explanation ?? ""}
              onChange={(e) => update(idx, { explanation: e.target.value })}
              aria-label={`Explicación de la pregunta ${idx + 1}`}
            />
          </motion.fieldset>
        ))}
      </AnimatePresence>

      <Button
        type="button"
        variant="secondary"
        leftIcon={<Plus />}
        disabled={disabled || questions.length >= 50}
        onClick={() => onChange([...questions, emptyQuestion()])}
        className="self-start"
      >
        Nueva pregunta
      </Button>
    </div>
  );
}
