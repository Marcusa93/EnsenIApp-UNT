"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp, Copy, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/lib/types/helpers";
import { formatTimestamp } from "./parse";

export interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  fullText: string;
  /** Salta el reproductor a ese segundo de la clase. */
  onSeek?: (seconds: number) => void;
  className?: string;
}

/** Une los micro-segmentos de Whisper en párrafos legibles (~35 s o ~420 caracteres). */
interface Block {
  start: number;
  text: string;
}

const BLOCK_MAX_SECONDS = 35;
const BLOCK_MAX_CHARS = 420;

function buildBlocks(segments: TranscriptSegment[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const s of segments) {
    const text = s.text.trim();
    if (!text) continue;
    if (
      !current ||
      s.start - current.start >= BLOCK_MAX_SECONDS ||
      current.text.length + text.length > BLOCK_MAX_CHARS
    ) {
      current = { start: s.start, text };
      blocks.push(current);
    } else {
      current.text += ` ${text}`;
    }
  }
  return blocks;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Coincidencia puntual: bloque + índice de aparición dentro del bloque. */
interface Match {
  block: number;
  occurrence: number;
}

function findMatches(blocks: Block[], query: string): Match[] {
  if (!query) return [];
  const re = new RegExp(escapeRegExp(query), "ig");
  const out: Match[] = [];
  blocks.forEach((b, bi) => {
    let occ = 0;
    while (re.exec(b.text) !== null) {
      out.push({ block: bi, occurrence: occ });
      occ++;
    }
    re.lastIndex = 0;
  });
  return out;
}

function HighlightedText({
  text,
  query,
  currentOccurrence,
}: {
  text: string;
  query: string;
  /** Índice de la aparición “actual” dentro de este bloque, o null. */
  currentOccurrence: number | null;
}) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(re);
  let occ = -1;
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        if (isMatch) occ++;
        const isCurrent = isMatch && occ === currentOccurrence;
        return isMatch ? (
          <mark
            key={i}
            data-current={isCurrent || undefined}
            className={cn(
              "rounded-sm px-0.5 text-foreground",
              isCurrent ? "bg-accent text-white ring-2 ring-accent/50" : "bg-accent-2/25",
            )}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Transcripción legible por párrafos, con reproductor integrado vía onSeek:
 * cada párrafo lleva su minuto clickeable, y el buscador navega coincidencia
 * por coincidencia (Enter/↓ siguiente, Shift+Enter/↑ anterior, Esc limpia).
 */
export function TranscriptViewer({ segments, fullText, onSeek, className }: TranscriptViewerProps) {
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  const blocks = React.useMemo(() => buildBlocks(segments), [segments]);
  const q = query.trim();
  const matches = React.useMemo(() => findMatches(blocks, q), [blocks, q]);
  const current = matches.length > 0 ? matches[Math.min(cursor, matches.length - 1)] : null;

  // Nueva búsqueda → arrancar desde la primera coincidencia.
  React.useEffect(() => {
    setCursor(0);
  }, [q]);

  // Autoscroll a la coincidencia actual.
  React.useEffect(() => {
    if (!current) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-block="${current.block}"] mark[data-current]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current]);

  const step = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    setCursor((c) => (c + dir + matches.length) % matches.length);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("[transcript] no se pudo copiar", err);
    }
  };

  if (blocks.length === 0 && !fullText.trim()) {
    return (
      <EmptyState
        compact
        tone="muted"
        title="La transcripción todavía no está disponible"
        description="Cuando el procesamiento termine, vas a poder leerla, buscar dentro de ella y escuchar cada momento."
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
              } else if (e.key === "Escape") {
                setQuery("");
              }
            }}
            placeholder="Buscar en la clase…"
            aria-label="Buscar en la transcripción"
            leftIcon={<Search />}
            className="pr-9"
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

        {q && (
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2 px-1.5 py-1">
            <span className="px-1.5 font-mono text-[11px] tabular-nums text-muted" aria-live="polite">
              {matches.length === 0 ? "0 resultados" : `${Math.min(cursor + 1, matches.length)} de ${matches.length}`}
            </span>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={matches.length === 0}
              aria-label="Coincidencia anterior"
              className="flex size-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-40"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={matches.length === 0}
              aria-label="Coincidencia siguiente"
              className="flex size-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-40"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        )}

        <Button variant="secondary" size="sm" onClick={copy} leftIcon={copied ? <Check /> : <Copy />} aria-live="polite">
          {copied ? "Copiada" : "Copiar"}
        </Button>
      </div>

      {blocks.length > 0 ? (
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-surface-2/40 sm:max-h-[34rem]"
          aria-label="Transcripción de la clase"
        >
          {blocks.map((b, i) => {
            const isCurrentBlock = current?.block === i;
            return (
              <div
                key={`${b.start}-${i}`}
                data-block={i}
                className={cn(
                  "flex gap-3 border-b border-border/50 px-3.5 py-3 text-sm leading-relaxed last:border-b-0",
                  isCurrentBlock && "bg-accent/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSeek?.(b.start)}
                  title="Escuchar desde acá"
                  className="mt-0.5 h-fit shrink-0 rounded-md border border-transparent px-1 py-0.5 font-mono text-[11px] tabular-nums text-accent-2 transition hover:border-accent-2/40 hover:bg-accent-2/10 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Escuchar desde el minuto ${formatTimestamp(b.start)}`}
                >
                  {formatTimestamp(b.start)}
                </button>
                <p className="min-w-0 flex-1">
                  <HighlightedText
                    text={b.text}
                    query={q}
                    currentOccurrence={isCurrentBlock ? (current?.occurrence ?? null) : null}
                  />
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-surface-2/40 p-4 text-sm leading-relaxed">
          {fullText}
        </div>
      )}
    </div>
  );
}
