"use client";

import * as React from "react";
import { BookOpen, FileText, HelpCircle, Layers, Lightbulb, RotateCcw, ScrollText, Terminal } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Markdown } from "@/components/markdown";
import { SummaryView } from "@/components/class-content/summary-view";
import { SimplifiedView } from "@/components/class-content/simplified-view";
import { TranscriptViewer } from "@/components/class-content/transcript-viewer";
import type { IndexedCard } from "@/components/class-content/parse";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getRecordingPreview, type RecordingPreviewData } from "./actions";

export interface RecordingPreviewProps {
  recordingId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Vista previa docente del material generado: resumen / placas / versión simple / transcripción.
 * Carga los datos al abrir (Server Action con RLS).
 */
export function RecordingPreview({ recordingId, title, open, onOpenChange }: RecordingPreviewProps) {
  const [data, setData] = React.useState<RecordingPreviewData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRecordingPreview(recordingId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setData(res.data);
        else setError(res.error);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "No se pudo cargar la vista previa."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, recordingId]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={title}
      description={
        data ? (
          <span className="flex flex-wrap items-center gap-2">
            {data.duration_seconds != null && <Badge size="sm">{formatDuration(data.duration_seconds)}</Badge>}
            {data.transcription_model && <Badge size="sm" tone="accent-2">{data.transcription_model}</Badge>}
            {data.generation_model && <Badge size="sm" tone="accent">{data.generation_model}</Badge>}
          </span>
        ) : (
          "Así van a ver el material los estudiantes cuando lo publiques."
        )
      }
    >
      {loading && !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton lines={2} />
          <Skeleton lines={6} />
        </div>
      ) : error ? (
        <EmptyState compact tone="muted" title="No se pudo cargar la vista previa" description={error} />
      ) : data ? (
        <Tabs defaultValue="resumen">
          <TabsList>
            <TabsTrigger value="resumen" icon={<FileText />}>Resumen</TabsTrigger>
            <TabsTrigger value="placas" icon={<Layers />} count={data.cards.length || undefined}>Placas</TabsTrigger>
            <TabsTrigger value="simple" icon={<BookOpen />}>Versión simple</TabsTrigger>
            <TabsTrigger value="transcripcion" icon={<ScrollText />} count={data.transcript?.segments.length || undefined}>
              Transcripción
            </TabsTrigger>
            <TabsTrigger value="log" icon={<Terminal />}>Registro</TabsTrigger>
          </TabsList>
          <TabsContent value="resumen">
            <SummaryView
              summaryMd={data.summary?.summary_md ?? ""}
              keyPoints={data.summary?.key_points ?? []}
              sections={data.summary?.sections ?? []}
              glossary={data.summary?.glossary ?? []}
            />
          </TabsContent>
          <TabsContent value="placas">
            <CardsReview cards={data.cards} />
          </TabsContent>
          <TabsContent value="simple">
            <SimplifiedView facil={data.simplified.facil} intermedio={data.simplified.intermedio} />
          </TabsContent>
          <TabsContent value="transcripcion">
            <TranscriptViewer segments={data.transcript?.segments ?? []} fullText={data.transcript?.full_text ?? ""} />
          </TabsContent>
          <TabsContent value="log">
            {data.log.length === 0 ? (
              <EmptyState compact tone="muted" title="Sin registro" description="Todavía no se procesó esta grabación." />
            ) : (
              <ol className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed">
                {data.log.map((e, i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 rounded-lg bg-surface-2/60 px-3 py-1.5">
                    <span className="text-muted">{e.at ? formatDateTime(e.at) : "—"}</span>
                    <span>
                      <span className="mr-2 uppercase tracking-widest text-accent-2">{e.step}</span>
                      {e.message}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </Dialog>
  );
}

const TYPE_META = {
  flashcard: { label: "Flashcard", icon: RotateCcw, tone: "accent" as const },
  quiz: { label: "Quiz", icon: HelpCircle, tone: "accent-2" as const },
  concept: { label: "Concepto", icon: Lightbulb, tone: "accent-3" as const },
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Listado completo de placas en modo revisión (muestra respuestas correctas y explicaciones). */
function CardsReview({ cards }: { cards: IndexedCard[] }) {
  if (cards.length === 0) {
    return (
      <EmptyState compact tone="muted" icon={Layers} title="Sin placas todavía" description="Se generan en la etapa de material de estudio." />
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {cards.map(({ index, card }) => {
        const meta = TYPE_META[card.type];
        const Icon = meta.icon;
        return (
          <li key={index} className="rounded-2xl border border-border bg-surface-2/40 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge size="sm" tone={meta.tone}>
                <Icon className="size-3" aria-hidden />
                {meta.label}
              </Badge>
              {card.tag && <Badge size="sm">{card.tag}</Badge>}
              <span className="ml-auto font-mono text-[10px] text-muted">#{index + 1}</span>
            </div>
            {card.type === "flashcard" && (
              <>
                <p className="text-sm font-medium">{card.question}</p>
                <p className="mt-1.5 text-sm text-muted">{card.answer}</p>
              </>
            )}
            {card.type === "quiz" && (
              <>
                <p className="text-sm font-medium">{card.question}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {card.options.map((o, i) => (
                    <li
                      key={i}
                      className={
                        i === card.correct_index
                          ? "rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-sm text-success"
                          : "rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted"
                      }
                    >
                      <span className="mr-2 font-mono text-[11px]">{LETTERS[i] ?? i + 1}</span>
                      {o}
                    </li>
                  ))}
                </ul>
                {card.explanation && <p className="mt-2 text-xs leading-relaxed text-muted">{card.explanation}</p>}
              </>
            )}
            {card.type === "concept" && (
              <>
                <p className="text-sm font-medium">{card.title}</p>
                <Markdown size="sm" className="mt-1.5">
                  {card.body_md}
                </Markdown>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
