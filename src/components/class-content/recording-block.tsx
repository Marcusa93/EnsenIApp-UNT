"use client";

import * as React from "react";
import { BookOpen, FileText, Layers, ScrollText } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/format";
import { track } from "@/lib/telemetry";
import type { RecordingContent } from "@/app/campus/estudiante/clases/_lib/data";
import { SummaryView } from "./summary-view";
import { CardsPreview } from "./cards-preview";
import { SimplifiedView } from "./simplified-view";
import { TranscriptViewer } from "./transcript-viewer";

export interface RecordingBlockProps {
  recording: RecordingContent;
  classId: string;
  /** Posición dentro de la clase (si hay varias grabaciones). */
  ordinal?: number;
}

type TabKey = "resumen" | "placas" | "simple" | "transcripcion";

/**
 * Bloque de una grabación publicada: tabs Resumen / Placas / Versión simple / Transcripción.
 * Emite summary_read, simplified_read y transcript_opened (una vez por grabación y tab).
 */
export function RecordingBlock({ recording, classId, ordinal }: RecordingBlockProps) {
  const [tab, setTab] = React.useState<TabKey>("resumen");
  const seen = React.useRef<Set<TabKey>>(new Set());

  React.useEffect(() => {
    if (seen.current.has(tab)) return;
    seen.current.add(tab);
    const meta = { class_id: classId, tab };
    if (tab === "resumen") void track("summary_read", { entity_type: "recording", entity_id: recording.id, metadata: meta });
    else if (tab === "simple") void track("simplified_read", { entity_type: "recording", entity_id: recording.id, metadata: meta });
    else if (tab === "transcripcion") void track("transcript_opened", { entity_type: "recording", entity_id: recording.id, metadata: meta });
  }, [tab, classId, recording.id]);

  const knownCount = recording.progress.filter((p) => p.known).length;
  const title = recording.title?.trim() || (ordinal ? `Grabación ${ordinal}` : "Grabación de la clase");

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 gap-2 border-b border-border px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle eyebrow="Grabación publicada" as="h3">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {recording.duration_seconds != null && (
              <Badge size="sm" tone="muted">
                {formatDuration(recording.duration_seconds)}
              </Badge>
            )}
            {recording.cards.length > 0 && (
              <Badge size="sm" tone={knownCount >= recording.cards.length ? "success" : "accent"}>
                {knownCount}/{recording.cards.length} placas
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Contenido generado con IA a partir de la clase y revisado por el equipo docente.
        </CardDescription>
      </CardHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="px-5 pb-5 sm:px-6 sm:pb-6">
        <TabsList className="-mx-5 px-5 sm:-mx-6 sm:px-6">
          <TabsTrigger value="resumen" icon={<FileText />}>
            Resumen
          </TabsTrigger>
          <TabsTrigger value="placas" icon={<Layers />} count={recording.cards.length || undefined}>
            Placas
          </TabsTrigger>
          <TabsTrigger value="simple" icon={<BookOpen />}>
            Versión simple
          </TabsTrigger>
          <TabsTrigger value="transcripcion" icon={<ScrollText />}>
            Transcripción
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <SummaryView
            summaryMd={recording.summary?.summary_md ?? ""}
            keyPoints={recording.summary?.key_points ?? []}
            sections={recording.summary?.sections ?? []}
            glossary={recording.summary?.glossary ?? []}
          />
        </TabsContent>
        <TabsContent value="placas">
          <CardsPreview recordingId={recording.id} cards={recording.cards} knownCount={knownCount} />
        </TabsContent>
        <TabsContent value="simple">
          <SimplifiedView
            facil={recording.simplified.facil}
            intermedio={recording.simplified.intermedio}
            onLevelChange={(level) =>
              void track("simplified_read", {
                entity_type: "recording",
                entity_id: recording.id,
                metadata: { class_id: classId, level },
              })
            }
          />
        </TabsContent>
        <TabsContent value="transcripcion">
          <TranscriptViewer
            segments={recording.transcript?.segments ?? []}
            fullText={recording.transcript?.full_text ?? ""}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
