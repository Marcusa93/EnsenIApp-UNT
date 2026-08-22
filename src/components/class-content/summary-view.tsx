import { ChevronDown, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import type { GlossaryTerm, SummarySection } from "@/lib/types/helpers";

export interface SummaryViewProps {
  summaryMd: string;
  keyPoints: string[];
  sections: SummarySection[];
  glossary: GlossaryTerm[];
}

/** Resumen IA de una grabación: puntos clave destacados, texto, secciones en acordeón y glosario. */
export function SummaryView({ summaryMd, keyPoints, sections, glossary }: SummaryViewProps) {
  if (!summaryMd.trim() && keyPoints.length === 0 && sections.length === 0) {
    return (
      <EmptyState
        compact
        tone="muted"
        icon={Sparkles}
        title="El resumen todavía no está listo"
        description="Se genera automáticamente cuando termina el procesamiento de la grabación."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {keyPoints.length > 0 && (
        <section aria-labelledby="key-points" className="rounded-2xl border border-accent/25 bg-accent/5 p-4 sm:p-5">
          <h4 id="key-points" className="eyebrow mb-3 flex items-center gap-2 text-accent">
            <Sparkles className="size-3.5" aria-hidden />
            Puntos clave
          </h4>
          <ol className="flex flex-col gap-2.5">
            {keyPoints.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-accent/15 font-mono text-[10px] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {summaryMd.trim() && <Markdown>{summaryMd}</Markdown>}

      {sections.length > 0 && (
        <section aria-label="Secciones de la clase" className="flex flex-col gap-2">
          <h4 className="eyebrow">Por secciones</h4>
          {sections.map((s, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-border bg-surface open:border-accent/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-ring rounded-2xl">
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-border px-4 py-3">
                <Markdown size="sm">{s.body_md}</Markdown>
              </div>
            </details>
          ))}
        </section>
      )}

      {glossary.length > 0 && (
        <section aria-label="Glosario">
          <h4 className="eyebrow mb-2">Glosario</h4>
          <p className="mb-3 text-xs text-muted">Pasá el cursor o enfocá un término para ver su definición.</p>
          <div className="flex flex-wrap gap-2">
            {glossary.map((g) => (
              <Tooltip key={g.term} content={g.definition} side="bottom">
                <button
                  type="button"
                  className="rounded-full border border-accent-2/30 bg-accent-2/10 px-3 py-1 text-xs font-medium text-accent-2 transition-colors hover:bg-accent-2/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {g.term}
                </button>
              </Tooltip>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
