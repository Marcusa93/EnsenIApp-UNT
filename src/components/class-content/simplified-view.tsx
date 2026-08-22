"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type SimplifiedLevel = "facil" | "intermedio";

export interface SimplifiedViewProps {
  facil: string | null;
  intermedio: string | null;
  onLevelChange?: (level: SimplifiedLevel) => void;
}

const LEVELS: { value: SimplifiedLevel; label: string; hint: string }[] = [
  { value: "facil", label: "Fácil", hint: "Sin tecnicismos, con ejemplos cotidianos" },
  { value: "intermedio", label: "Intermedio", hint: "Con vocabulario jurídico explicado" },
];

/** Versión en lenguaje simple con toggle fácil / intermedio. */
export function SimplifiedView({ facil, intermedio, onLevelChange }: SimplifiedViewProps) {
  const available = LEVELS.filter((l) => (l.value === "facil" ? facil : intermedio));
  const [level, setLevel] = React.useState<SimplifiedLevel>(available[0]?.value ?? "facil");
  const content = level === "facil" ? facil : intermedio;

  if (available.length === 0) {
    return (
      <EmptyState
        compact
        tone="muted"
        icon={BookOpen}
        title="La versión simple todavía no está lista"
        description="Se genera automáticamente a partir de la transcripción."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Nivel de simplificación"
        className="inline-flex w-fit rounded-xl border border-border bg-surface-2 p-1"
      >
        {LEVELS.map((l) => {
          const disabled = !available.some((a) => a.value === l.value);
          const active = level === l.value;
          return (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              title={disabled ? "No disponible para esta clase" : l.hint}
              onClick={() => {
                setLevel(l.value);
                onLevelChange?.(l.value);
              }}
              className={cn(
                "h-8 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
                active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">{LEVELS.find((l) => l.value === level)?.hint}</p>
      {content ? <Markdown size="lg">{content}</Markdown> : null}
    </div>
  );
}
