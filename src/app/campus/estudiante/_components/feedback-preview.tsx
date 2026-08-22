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

export function FeedbackPreview({ feedback }: { feedback: FeedbackSummary | null }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -bottom-16 -right-16 size-48 rounded-full bg-accent opacity-[0.1] blur-3xl" aria-hidden />
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="eyebrow">Tu devolución personalizada</span>
            {feedback ? (
              <Badge tone="accent" size="sm">
                {formatRelative(feedback.created_at)}
              </Badge>
            ) : (
              <Badge tone="muted" size="sm">
                Todavía no generada
              </Badge>
            )}
          </div>
          {feedback ? (
            <Markdown size="sm" className="text-muted [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm">
              {preview(feedback.feedback_md)}
            </Markdown>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/12 text-accent">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">La IA puede leer tu recorrido y armarte una devolución</p>
                <p className="mt-1 text-sm text-muted">
                  Con tus check-ins, placas, entregas y consultas te propone qué va bien, qué reforzar y un plan de 3
                  pasos. Cuanto más uses el campus, más precisa.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2 lg:flex-col">
          <Button asChild size="sm" rightIcon={<ArrowRight />} variant={feedback ? "secondary" : "primary"}>
            <Link href="/campus/estudiante/progreso">{feedback ? "Leer completa" : "Generar mi devolución"}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" leftIcon={<TrendingUp />}>
            <Link href="/campus/estudiante/progreso">Mi progreso</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
