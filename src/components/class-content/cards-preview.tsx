import Link from "next/link";
import { ArrowRight, HelpCircle, Layers, Lightbulb, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import type { IndexedCard } from "./parse";

export interface CardsPreviewProps {
  recordingId: string;
  cards: IndexedCard[];
  /** Índices de placas marcadas como conocidas por el estudiante. */
  knownCount: number;
}

const TYPE_META = {
  flashcard: { label: "Flashcard", icon: RotateCcw, tone: "accent" as const },
  quiz: { label: "Quiz", icon: HelpCircle, tone: "accent-2" as const },
  concept: { label: "Concepto", icon: Lightbulb, tone: "accent-3" as const },
};

function cardTitle(c: IndexedCard["card"]): string {
  return c.type === "concept" ? c.title : c.question;
}

/** Vista previa de 3 placas + CTA al modo inmersivo con progreso. */
export function CardsPreview({ recordingId, cards, knownCount }: CardsPreviewProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        compact
        tone="muted"
        icon={Layers}
        title="Las placas todavía no están listas"
        description="Se generan automáticamente a partir de la clase: flashcards, quiz y conceptos clave."
      />
    );
  }
  const total = cards.length;
  const pct = total > 0 ? (knownCount / total) * 100 : 0;
  const done = knownCount >= total;
  const counts = cards.reduce(
    (acc, c) => {
      acc[c.card.type] += 1;
      return acc;
    },
    { flashcard: 0, quiz: 0, concept: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.slice(0, 3).map(({ index, card }) => {
          const meta = TYPE_META[card.type];
          const Icon = meta.icon;
          return (
            <div
              key={index}
              className="relative flex min-h-32 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-accent/10 blur-2xl" aria-hidden />
              <Badge size="sm" tone={meta.tone}>
                <Icon className="size-3" aria-hidden />
                {meta.label}
              </Badge>
              <p className="mt-3 line-clamp-3 text-sm font-medium leading-snug">{cardTitle(card)}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-2/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-mono">{total} placas</span>
            <span aria-hidden>·</span>
            <span>{counts.flashcard} flashcards</span>
            <span aria-hidden>·</span>
            <span>{counts.quiz} quiz</span>
            <span aria-hidden>·</span>
            <span>{counts.concept} conceptos</span>
          </div>
          <Progress
            value={pct}
            tone={done ? "success" : "accent"}
            size="sm"
            label={`${knownCount}/${total} conocidas`}
            showValue
          />
        </div>
        <Button asChild size="lg">
          <Link href={`/campus/estudiante/placas/${recordingId}`}>
            {knownCount === 0 ? "Empezar placas" : done ? "Repasar de nuevo" : "Continuar"}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
