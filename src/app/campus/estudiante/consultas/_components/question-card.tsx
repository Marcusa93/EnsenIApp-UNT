import Link from "next/link";
import { Bot, EyeOff, GraduationCap, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { formatDate, formatRelative } from "@/lib/format";
import type { Enums } from "@/lib/types/helpers";
import { ConsultaThread, type ThreadMessage } from "@/components/consultas/thread";
import { QUESTION_STATUS_LABEL, QUESTION_STATUS_TONE } from "../../_components/student-data";

export interface QuestionItem {
  id: string;
  question: string;
  status: Enums<"question_status">;
  ai_answer_md: string | null;
  teacher_answer_md: string | null;
  teacher_name: string | null;
  is_anonymous: boolean;
  is_public: boolean;
  created_at: string;
  answered_at: string | null;
  class: { id: string; topic: string; class_date: string } | null;
  /** Para consultas de compañeros: nombre visible (null si anónima o sin permiso). */
  author_name?: string | null;
  /** El ida y vuelta con el equipo docente. Sólo viene en las consultas propias. */
  messages?: ThreadMessage[];
}

export function QuestionCard({ item, mine = true }: { item: QuestionItem; mine?: boolean }) {
  const hasAnyAnswer = Boolean(item.ai_answer_md || item.teacher_answer_md);
  return (
    <Card className="relative overflow-hidden">
      <article aria-labelledby={`q-${item.id}`}>
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={QUESTION_STATUS_TONE[item.status]} size="sm" dot={item.status === "abierta"} live={item.status === "abierta"}>
            {QUESTION_STATUS_LABEL[item.status]}
          </Badge>
          {mine && item.is_anonymous && (
            <Badge tone="muted" size="sm" className="gap-1">
              <EyeOff className="size-3" aria-hidden /> anónima
            </Badge>
          )}
          {mine && item.is_public && (
            <Badge tone="muted" size="sm" className="gap-1">
              <Users className="size-3" aria-hidden /> pública
            </Badge>
          )}
          {!mine && (
            <span className="text-xs text-muted">{item.author_name ?? "Un compañero"}</span>
          )}
          <time dateTime={item.created_at} className="ml-auto font-mono text-[11px] text-muted" title={formatDate(item.created_at)}>
            {formatRelative(item.created_at)}
          </time>
        </header>

        <p id={`q-${item.id}`} className="whitespace-pre-line text-[15px] font-medium leading-relaxed">
          {item.question}
        </p>
        {item.class && (
          <Link
            href={`/campus/estudiante/clases/${item.class.id}`}
            className="mt-1.5 inline-block font-mono text-[11px] uppercase tracking-widest text-accent-2 underline-offset-4 hover:underline"
          >
            Clase · {item.class.topic}
          </Link>
        )}

        {item.teacher_answer_md && (
          <div className="mt-4 rounded-2xl border border-success/25 bg-success/5 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-success/30 bg-success/12 text-success">
                <GraduationCap className="size-3.5" aria-hidden />
              </span>
              <span className="eyebrow text-success">Respuesta del equipo docente</span>
              {item.teacher_name && <span className="text-xs text-muted">· {item.teacher_name}</span>}
              {item.answered_at && (
                <time dateTime={item.answered_at} className="ml-auto font-mono text-[11px] text-muted">
                  {formatRelative(item.answered_at)}
                </time>
              )}
            </div>
            <Markdown size="sm" className="[&_h2]:text-base [&_h3]:text-sm">
              {item.teacher_answer_md}
            </Markdown>
          </div>
        )}

        {item.ai_answer_md && (
          <details className="group mt-3 rounded-2xl border border-accent-2/25 bg-accent-2/5" open={!item.teacher_answer_md}>
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
              <span className="flex size-7 items-center justify-center rounded-lg border border-accent-2/30 bg-accent-2/12 text-accent-2">
                <Bot className="size-3.5" aria-hidden />
              </span>
              <span className="eyebrow text-accent-2">Respuesta de la IA</span>
              <span className="ml-auto font-mono text-[11px] text-muted group-open:hidden">ver</span>
              <span className="ml-auto hidden font-mono text-[11px] text-muted group-open:inline">ocultar</span>
            </summary>
            <div className="px-4 pb-4">
              <Markdown size="sm" className="[&_h2]:text-base [&_h3]:text-sm">
                {item.ai_answer_md}
              </Markdown>
              <p className="mt-3 text-xs text-muted">
                Generada automáticamente a partir del material de la clase. El equipo docente puede corregirla.
              </p>
            </div>
          </details>
        )}

        {!hasAnyAnswer && (
          <p className="mt-3 text-sm text-muted">
            {mine
              ? "Todavía sin respuesta: la IA la intenta apenas la enviás y el equipo docente la ve en su panel."
              : "Todavía sin respuesta."}
          </p>
        )}

        {/* El hilo va sólo en las propias: la consulta de un compañero se lee,
            no se interviene. */}
        {mine && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="eyebrow mb-2 text-[10px]">
              {item.messages?.length ? "Conversación con el equipo docente" : "¿Te quedó una duda?"}
            </p>
            <ConsultaThread questionId={item.id} messages={item.messages ?? []} viewerRole="estudiante" />
          </div>
        )}
      </article>
    </Card>
  );
}
