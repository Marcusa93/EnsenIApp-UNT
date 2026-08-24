import { Check, CircleDashed, FileDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/types/helpers";
import type { Submission } from "./model";
import { parseEssayAnswers, parseQuizAnswers, parseQuizContent, parseReadingAnswers } from "./model";

export interface AnswersViewProps {
  activity: Pick<Activity, "type" | "content" | "max_score">;
  submission: Pick<Submission, "answers" | "auto_score">;
  /** URL firmada del adjunto (entrega), si existe. */
  fileUrl?: string | null;
  /** Mostrar correctas/explicaciones (cuestionario). */
  revealAnswers?: boolean;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Render server-safe de las respuestas de una entrega según el tipo de actividad. */
export function AnswersView({ activity, submission, fileUrl, revealAnswers = true }: AnswersViewProps) {
  if (activity.type === "cuestionario") {
    const content = parseQuizContent(activity.content);
    const answers = parseQuizAnswers(submission.answers);
    const correct = content.questions.filter((q) => answers.choices[q.id] === q.correct_index).length;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
          <Badge tone={correct === content.questions.length ? "success" : "accent-2"}>
            {correct}/{content.questions.length} correctas
          </Badge>
          {submission.auto_score != null && (
            <span>
              Puntaje automático: <span className="text-foreground">{submission.auto_score}</span> / {activity.max_score ?? 10}
            </span>
          )}
        </div>
        <ol className="flex flex-col gap-3">
          {content.questions.map((q, i) => {
            const chosen = answers.choices[q.id];
            const isCorrect = chosen === q.correct_index;
            return (
              <li key={q.id} className="rounded-2xl border border-border bg-surface-2/40 p-4">
                <p className="mb-3 text-sm font-medium">
                  <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                  {q.prompt}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {q.options.map((opt, oi) => {
                    const picked = chosen === oi;
                    const right = revealAnswers && oi === q.correct_index;
                    return (
                      <li
                        key={oi}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                          right && "border-success/40 bg-success/10",
                          picked && !right && revealAnswers && "border-danger/40 bg-danger/10",
                          picked && !revealAnswers && "border-accent/40 bg-accent/10",
                          !picked && !right && "border-transparent text-muted",
                        )}
                      >
                        <span className="font-mono text-xs">{LETTERS[oi]}</span>
                        <span className="flex-1">{opt}</span>
                        {picked && (
                          <Badge size="sm" tone={revealAnswers ? (isCorrect ? "success" : "danger") : "accent"}>
                            {revealAnswers ? (isCorrect ? <Check className="size-3" /> : <X className="size-3" />) : null}
                            elegida
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {chosen === undefined && (
                  <p className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-muted">
                    <CircleDashed className="size-3" aria-hidden /> Sin responder
                  </p>
                )}
                {revealAnswers && q.explanation && (
                  <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
                    <span className="eyebrow mr-2 text-[10px]">Explicación</span>
                    {q.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (activity.type === "lectura") {
    const a = parseReadingAnswers(submission.answers);
    return (
      <div className="flex flex-col gap-3">
        <Badge tone={a.read ? "success" : "warning"} dot>
          {a.read ? "Marcada como leída" : "No marcada como leída"}
        </Badge>
        {a.reflection.trim() ? (
          <div className="rounded-2xl border border-border bg-surface-2/40 p-4">
            <span className="eyebrow">Reflexión</span>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{a.reflection}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Sin reflexión escrita.</p>
        )}
      </div>
    );
  }

  if (activity.type === "entrega") {
    const a = parseEssayAnswers(submission.answers);
    return (
      <div className="flex flex-col gap-3">
        {a.text.trim() ? (
          <div className="rounded-2xl border border-border bg-surface-2/40 p-4">
            <Markdown size="sm">{a.text}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-muted">Sin texto escrito.</p>
        )}
        {a.file_path &&
          (fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:border-accent/60"
            >
              <FileDown className="size-4 text-accent-2" aria-hidden />
              {a.file_name ?? "Archivo adjunto"}
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">1 h</span>
            </a>
          ) : (
            <p className="text-sm text-warning">El adjunto «{a.file_name ?? a.file_path}» no está disponible ahora.</p>
          ))}
      </div>
    );
  }

  return <p className="text-sm text-muted">Este tipo de actividad se revisa desde su propio módulo.</p>;
}
