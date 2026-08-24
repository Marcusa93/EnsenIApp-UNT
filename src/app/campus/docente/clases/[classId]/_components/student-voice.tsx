import Link from "next/link";
import { ArrowRight, Gauge, MessageCircleQuestion, MessageSquareText } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, type BadgeTone } from "@/components/ui";
import type { StudentVoice as StudentVoiceData } from "@/components/docente/class-data";
import { formatRelative } from "@/lib/format";
import type { Enums } from "@/lib/types/helpers";
import { cn } from "@/lib/utils";

const LEVELS = ["Muy fácil", "Fácil", "Normal", "Difícil", "Muy difícil"] as const;
const LEVEL_BAR = ["bg-accent-2", "bg-accent-2/80", "bg-accent", "bg-warning", "bg-danger"] as const;

const Q_STATUS: Record<Enums<"question_status">, { label: string; tone: BadgeTone }> = {
  abierta: { label: "Abierta", tone: "warning" },
  respondida_ia: { label: "Respondió la IA", tone: "accent-2" },
  respondida_docente: { label: "Respondida", tone: "success" },
  cerrada: { label: "Cerrada", tone: "muted" },
};

export interface StudentVoiceProps {
  classId: string;
  voice: StudentVoiceData;
}

/** Distribución de dificultad, comentarios de check-ins y consultas de la clase. */
export function StudentVoice({ classId, voice }: StudentVoiceProps) {
  const max = Math.max(1, ...voice.distribution);
  const openCount = voice.questions.filter((q) => q.status === "abierta").length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle eyebrow="Voz del estudiante">¿Cómo les fue?</CardTitle>
          <CardDescription>Check-ins de dificultad y consultas ligadas a esta clase.</CardDescription>
        </div>
        {voice.avg !== null && (
          <Badge tone={voice.avg >= 3.5 ? "danger" : voice.avg >= 2.5 ? "warning" : "success"} dot>
            Prom. {voice.avg.toFixed(1)} / 5
          </Badge>
        )}
      </CardHeader>

      {voice.total === 0 ? (
        <EmptyState
          compact
          tone="muted"
          icon={Gauge}
          title="Todavía no hay check-ins"
          description="Después de la clase, los estudiantes marcan qué tan difícil les resultó. Acá vas a ver la distribución."
        />
      ) : (
        <div role="img" aria-label={`Distribución de dificultad sobre ${voice.total} check-ins`} className="flex flex-col gap-2">
          {voice.distribution.map((n, i) => {
            const pct = Math.round((n / voice.total) * 100);
            return (
              <div key={i} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-xs">
                <span className="font-mono uppercase tracking-widest text-muted">
                  {i + 1} · {LEVELS[i]}
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-700 ease-out", LEVEL_BAR[i])}
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </div>
                <span className="text-right font-mono tabular-nums text-muted">
                  {n} <span className="text-[10px]">({pct} %)</span>
                </span>
              </div>
            );
          })}
          <p className="mt-1 text-xs text-muted">{voice.total} check-ins en total.</p>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="eyebrow mb-2 inline-flex items-center gap-1.5">
          <MessageSquareText className="size-3.5" aria-hidden /> Comentarios
        </h4>
        {voice.comments.length === 0 ? (
          <p className="text-sm text-muted">Nadie dejó comentarios todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {voice.comments.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
                <p className="text-sm leading-snug">“{c.comment}”</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                  <Badge size="sm" tone={c.difficulty >= 4 ? "danger" : c.difficulty === 3 ? "warning" : "accent-2"}>
                    {LEVELS[c.difficulty - 1]}
                  </Badge>
                  <span className="truncate">{c.student_name ?? "Estudiante"}</span>
                  <span aria-hidden>·</span>
                  <span>{formatRelative(c.created_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="eyebrow inline-flex items-center gap-1.5">
            <MessageCircleQuestion className="size-3.5" aria-hidden /> Consultas de la clase
            {openCount > 0 && (
              <Badge size="sm" tone="warning">
                {openCount} abiertas
              </Badge>
            )}
          </h4>
          <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
            <Link href={`/campus/docente/consultas?classId=${classId}`}>Responder</Link>
          </Button>
        </div>
        {voice.questions.length === 0 ? (
          <p className="text-sm text-muted">No hay consultas vinculadas a esta clase.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {voice.questions.map((q) => (
              <li key={q.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
                <p className="line-clamp-2 text-sm leading-snug">{q.question}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                  <Badge size="sm" tone={Q_STATUS[q.status].tone}>
                    {Q_STATUS[q.status].label}
                  </Badge>
                  <span className="truncate">{q.student_name ?? "Anónimo"}</span>
                  <span aria-hidden>·</span>
                  <span>{formatRelative(q.created_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
