import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { formatRelative } from "@/lib/format";

export interface FeedbackSummary {
  id: string;
  feedback_md: string;
  created_at: string;
}

/** Recorta el Markdown a los primeros párrafos para la vista previa. */
function preview(md: string, maxChars = 520): string {
  const trimmed = md.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf("\n\n"), cut.lastIndexOf(". "));
  return `${cut.slice(0, lastBreak > 200 ? lastBreak + 1 : maxChars).trimEnd()}…`;
}

/** Devolución generada por IA: todo lo que es IA va en violeta (Laboratorio DYNTEC). */
export function FeedbackPreview({ feedback }: { feedback: FeedbackSummary | null }) {
  return (
    <Card className="relative overflow-hidden border-accent-3/30">
      <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="accent-3" size="sm">
              <Sparkles className="size-3" aria-hidden />
              IA
            </Badge>
            <span className="eyebrow text-accent-3">Tu devolución personalizada</span>
            {feedback ? (
              <time dateTime={feedback.created_at} className="font-mono text-[11px] tabular-nums text-muted">
                {formatRelative(feedback.created_at)}
              </time>
            ) : (
              <Badge tone="muted" size="sm">
                Todavía no generada
              </Badge>
            )}
          </div>
          {feedback ? (
            // La voz de la IA se cita con una pleca violeta.
            <div className="border-l-[3px] border-l-accent-3 pl-4">
              <Markdown size="sm" className="text-muted [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm">
                {preview(feedback.feedback_md)}
              </Markdown>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-3/30 bg-accent-3/10 text-accent-3">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold">La IA puede leer tu recorrido y armarte una devolución</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Con tus check-ins, placas, entregas y consultas te propone qué va bien, qué reforzar y un plan de 3
                  pasos. Cuanto más uses el campus, más precisa.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
          <Button asChild rightIcon={<ArrowRight />} variant={feedback ? "outline" : "primary"}>
            <Link href="/campus/estudiante/progreso">{feedback ? "Leer completa" : "Generar mi devolución"}</Link>
          </Button>
          <Button asChild variant="ghost" leftIcon={<TrendingUp />}>
            <Link href="/campus/estudiante/progreso">Mi progreso</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
