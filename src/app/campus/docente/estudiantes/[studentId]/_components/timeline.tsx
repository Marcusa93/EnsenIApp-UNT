"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "./student-detail-data";

const EVENT_LABEL: Record<string, string> = {
  page_view: "Vio una página",
  class_opened: "Abrió una clase",
  recording_played: "Reprodujo una grabación",
  summary_read: "Leyó el resumen",
  simplified_read: "Leyó la versión simple",
  transcript_opened: "Abrió la transcripción",
  card_flipped: "Dio vuelta una placa",
  card_marked: "Marcó una placa",
  quiz_answered: "Respondió un quiz",
  cards_session_completed: "Completó una sesión de placas",
  activity_viewed: "Vio una actividad",
  activity_started: "Empezó una actividad",
  activity_answer_changed: "Editó una respuesta",
  activity_submitted: "Entregó una actividad",
  checkin_submitted: "Hizo un check-in",
  question_asked: "Hizo una consulta",
  poll_answered: "Respondió una encuesta",
  debate_opened: "Abrió un debate",
  argument_posted: "Publicó un argumento",
  argument_supported: "Apoyó un argumento",
  feedback_generated: "Generó su devolución IA",
  focus_lost: "Salió de la pestaña",
  focus_gained: "Volvió a la pestaña",
  offline_queued: "Guardó sin conexión",
  offline_flushed: "Sincronizó al reconectar",
};

const NOISY = new Set(["page_view", "focus_lost", "focus_gained", "activity_answer_changed", "card_flipped"]);

function dotClass(type: string) {
  if (type.startsWith("activity")) return "bg-accent";
  if (type.startsWith("card") || type === "quiz_answered" || type === "cards_session_completed") return "bg-accent-2";
  if (type === "question_asked" || type === "checkin_submitted" || type === "poll_answered") return "bg-accent-3";
  if (type.startsWith("debate") || type.startsWith("argument")) return "bg-warning";
  return "bg-muted";
}

export function Timeline({ events, truncated }: { events: TimelineEvent[]; truncated: boolean }) {
  const [showNoise, setShowNoise] = React.useState(false);
  const [limit, setLimit] = React.useState(40);

  const visible = (showNoise ? events : events.filter((e) => !NOISY.has(e.event_type))).slice(0, limit);
  const hiddenNoise = events.length - events.filter((e) => !NOISY.has(e.event_type)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
          {events.length} eventos {truncated ? "(últimos)" : ""}
        </span>
        {hiddenNoise > 0 && (
          <button
            type="button"
            onClick={() => setShowNoise((v) => !v)}
            className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            {showNoise ? "Ocultar" : "Mostrar"} navegación y foco ({hiddenNoise})
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">Sin eventos registrados todavía.</p>
      ) : (
        <ol className="relative ml-2 flex flex-col gap-0 border-l border-border pl-5">
          {visible.map((e) => (
            <li key={e.id} className="relative py-1.5">
              <span className={cn("absolute -left-[25px] top-3 size-2 rounded-full ring-4 ring-background", dotClass(e.event_type))} aria-hidden />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-sm">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{e.entity_type}</span>
                <time dateTime={e.created_at} className="ml-auto font-mono text-[11px] text-muted">
                  {formatDateTime(e.created_at)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
      {visible.length < (showNoise ? events.length : events.filter((e) => !NOISY.has(e.event_type)).length) && (
        <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 40)} className="self-center">
          Ver más
        </Button>
      )}
    </div>
  );
}
