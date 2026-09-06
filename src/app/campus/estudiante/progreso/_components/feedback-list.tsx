import { Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { formatDateTime, formatRelative } from "@/lib/format";

export interface FeedbackRow {
  id: string;
  feedback_md: string;
  model: string | null;
  created_at: string;
}

/** Lista de devoluciones IA: la más reciente abierta y destacada; las anteriores colapsadas. */
export function FeedbackList({ items }: { items: FeedbackRow[] }) {
  if (items.length === 0) return null;
  const [latest, ...previous] = items;
  return (
    <div className="flex flex-col gap-3">
      {/* Devolución generada por IA: todo lo que es IA va en violeta (accent-3),
          igual que su vista previa en Hoy (feedback-preview.tsx). Tarjeta protagonista
          de la pantalla, pero sin el prop `highlight`: ese modificador trae un glow
          carmesí fijo (no sigue `tone`), así que las esquinas y la pleca superior se
          arman a mano en violeta con `glow-3`. */}
      <Card className="corners glow-3 relative overflow-hidden border-t-[3px] border-t-accent-3">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent-3 opacity-[0.14] blur-3xl" aria-hidden />
        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-accent-3" aria-hidden />
            <span className="eyebrow text-accent-3">Tu última devolución</span>
            <Badge tone="accent-3" size="sm">
              {formatRelative(latest.created_at)}
            </Badge>
            <time dateTime={latest.created_at} className="ml-auto font-mono text-[11px] text-muted">
              {formatDateTime(latest.created_at)}
            </time>
          </div>
          <Markdown>{latest.feedback_md}</Markdown>
        </div>
      </Card>

      {previous.length > 0 && (
        <section aria-label="Devoluciones anteriores" className="flex flex-col gap-2">
          <span className="eyebrow mt-2">Anteriores ({previous.length})</span>
          {previous.map((f) => (
            <details key={f.id} className="group rounded-2xl border border-border bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
                <Sparkles className="size-3.5 text-muted" aria-hidden />
                <span className="font-medium">Devolución del {formatDateTime(f.created_at)}</span>
                <span className="ml-auto font-mono text-[11px] text-muted">{formatRelative(f.created_at)}</span>
                <span className="font-mono text-[11px] text-accent-3 group-open:hidden">ver</span>
                <span className="hidden font-mono text-[11px] text-accent-3 group-open:inline">ocultar</span>
              </summary>
              <div className="border-t border-border px-5 py-4">
                <Markdown size="sm">{f.feedback_md}</Markdown>
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
