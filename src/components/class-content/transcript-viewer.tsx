"use client";

import * as React from "react";
import { Check, Copy, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/lib/types/helpers";
import { formatTimestamp } from "./parse";

export interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  fullText: string;
  /** Se invoca al clickear un timestamp (p. ej. para un reproductor futuro). */
  onSeek?: (seconds: number) => void;
  className?: string;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-accent-2/30 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Transcripción navegable: segmentos con timestamp mono clickeable, buscador con
 * resaltado y botón copiar. Sólo texto (sin reproductor).
 */
export function TranscriptViewer({ segments, fullText, onSeek, className }: TranscriptViewerProps) {
  const [query, setQuery] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [active, setActive] = React.useState<number | null>(null);
  const listRef = React.useRef<HTMLOListElement>(null);

  const q = query.trim();
  const matches = React.useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return segments.map((s, i) => (s.text.toLowerCase().includes(lower) ? i : -1)).filter((i) => i >= 0);
  }, [segments, q]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("[transcript] no se pudo copiar", err);
    }
  };

  const jumpTo = (i: number) => {
    setActive(i);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-seg="${i}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  if (segments.length === 0 && !fullText.trim()) {
    return (
      <EmptyState
        compact
        tone="muted"
        title="La transcripción todavía no está disponible"
        description="Cuando el procesamiento termine, vas a poder leerla y buscar dentro de ella."
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la transcripción…"
            aria-label="Buscar en la transcripción"
            leftIcon={<Search />}
            className="pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {q && (
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted" aria-live="polite">
              {matches.length} {matches.length === 1 ? "coincidencia" : "coincidencias"}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={copy}
            leftIcon={copied ? <Check /> : <Copy />}
            aria-live="polite"
          >
            {copied ? "Copiada" : "Copiar"}
          </Button>
        </div>
      </div>

      {q && matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Saltar a coincidencia">
          {matches.slice(0, 12).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => jumpTo(i)}
              className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-accent-2 hover:border-accent-2/60"
            >
              {formatTimestamp(segments[i].start)}
            </button>
          ))}
          {matches.length > 12 && (
            <span className="px-1 font-mono text-[11px] text-muted">+{matches.length - 12}</span>
          )}
        </div>
      )}

      {segments.length > 0 ? (
        <ol
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-surface-2/40 p-1 sm:max-h-[32rem]"
          aria-label="Segmentos de la transcripción"
        >
          {segments.map((s, i) => {
            const isMatch = q ? s.text.toLowerCase().includes(q.toLowerCase()) : false;
            return (
              <li
                key={`${s.start}-${i}`}
                data-seg={i}
                className={cn(
                  "flex gap-3 rounded-xl px-2.5 py-2 text-sm leading-relaxed transition-colors",
                  active === i && "bg-accent/10",
                  q && !isMatch && "opacity-50",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActive(i);
                    onSeek?.(s.start);
                  }}
                  className="mt-0.5 shrink-0 rounded-md font-mono text-[11px] tabular-nums text-accent-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Ir al minuto ${formatTimestamp(s.start)}`}
                >
                  {formatTimestamp(s.start)}
                </button>
                <p className="min-w-0 flex-1">
                  <Highlight text={s.text} query={q} />
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-surface-2/40 p-4 text-sm leading-relaxed">
          <Highlight text={fullText} query={q} />
        </div>
      )}
    </div>
  );
}
