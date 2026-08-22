"use client";

import { Check, Lightbulb, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Markdown } from "@/components/markdown";

export interface ConceptCardProps {
  title: string;
  bodyMd: string;
  tag?: string;
  onMark: (known: boolean) => void;
}

/** Placa de concepto: lectura + "lo tengo claro" / "repasar". */
export function ConceptCard({ title, bodyMd, tag, onMark }: ConceptCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl border border-accent-3/30 bg-surface p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-accent-3/15 blur-3xl" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-2 text-accent-3">
            <Lightbulb className="size-3.5" aria-hidden />
            Concepto clave
          </span>
          {tag && (
            <Badge size="sm" tone="muted">
              {tag}
            </Badge>
          )}
        </div>
        <h3 className="text-balance text-xl font-semibold leading-snug sm:text-2xl">{title}</h3>
        <div className="mt-4 max-h-[40vh] overflow-y-auto pr-1">
          <Markdown size="md">{bodyMd}</Markdown>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => onMark(false)}
          leftIcon={<RotateCcw />}
          className="border-warning/40 text-warning hover:bg-warning/10"
        >
          Repasar
          <Kbd className="ml-1 hidden sm:inline-flex">←</Kbd>
        </Button>
        <Button size="lg" onClick={() => onMark(true)} leftIcon={<Check />}>
          Lo tengo claro
          <Kbd className="ml-1 hidden border-white/30 bg-white/10 text-white sm:inline-flex">→</Kbd>
        </Button>
      </div>
    </div>
  );
}
