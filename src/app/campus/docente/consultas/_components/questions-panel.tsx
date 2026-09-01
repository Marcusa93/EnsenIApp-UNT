"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Lock, LockOpen, MessageCircleQuestion, Search, Send, Sparkles, X } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Input, Switch, Textarea, type BadgeTone } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConsultaThread } from "@/components/consultas/thread";
import { answerQuestion, setQuestionClosed, setQuestionPublic } from "../actions";
import type { QuestionItem, QuestionStatus } from "./consultas-data";

type Filter = "todas" | QuestionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "abierta", label: "Abiertas" },
  { value: "respondida_ia", label: "Respondidas IA" },
  { value: "respondida_docente", label: "Respondidas docente" },
  { value: "cerrada", label: "Cerradas" },
];

const STATUS_META: Record<QuestionStatus, { label: string; tone: BadgeTone }> = {
  abierta: { label: "Abierta", tone: "warning" },
  respondida_ia: { label: "Respondida por IA", tone: "accent-2" },
  respondida_docente: { label: "Respondida por docente", tone: "success" },
  cerrada: { label: "Cerrada", tone: "muted" },
};

export function QuestionsPanel({ questions }: { questions: QuestionItem[] }) {
  const [filter, setFilter] = React.useState<Filter>("todas");
  const [query, setQuery] = React.useState("");

  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { todas: questions.length, abierta: 0, respondida_ia: 0, respondida_docente: 0, cerrada: 0 };
    for (const q of questions) c[q.status] += 1;
    return c;
  }, [questions]);

  const q = query.trim().toLowerCase();
  const filtered = questions.filter(
    (item) =>
      (filter === "todas" || item.status === filter) &&
      (!q ||
        item.question.toLowerCase().includes(q) ||
        (item.student_name ?? "").toLowerCase().includes(q) ||
        (item.class_topic ?? "").toLowerCase().includes(q)),
  );

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        tone="accent-2"
        title="Todavía no hay consultas"
        description="Cuando los estudiantes pregunten desde una clase o desde “Mis consultas”, las vas a ver acá con la respuesta que les dio la IA."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar consultas por estado">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground",
                )}
              >
                {f.label} · {counts[f.value]}
              </button>
            );
          })}
        </div>
        <Input
          aria-label="Buscar en las consultas"
          placeholder="Buscar…"
          leftIcon={<Search />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact tone="muted" icon={Search} title="Sin resultados" description="Ninguna consulta coincide con el filtro elegido." />
      ) : (
        <ul className="stagger flex flex-col gap-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <QuestionCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({ item }: { item: QuestionItem }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"answer" | "public" | "closed" | null>(null);

  const meta = STATUS_META[item.status];
  const name = item.student_name ?? "Estudiante anónimo";

  const startEditing = (base: string) => {
    setDraft(base);
    setEditing(true);
    setError(null);
  };

  const submitAnswer = () => {
    setBusy("answer");
    setError(null);
    startTransition(async () => {
      const res = await answerQuestion({ question_id: item.id, answer_md: draft });
      setBusy(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const togglePublic = (next: boolean) => {
    setBusy("public");
    setError(null);
    startTransition(async () => {
      const res = await setQuestionPublic({ question_id: item.id, is_public: next });
      setBusy(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const toggleClosed = (closed: boolean) => {
    setBusy("closed");
    setError(null);
    startTransition(async () => {
      const res = await setQuestionClosed({ question_id: item.id, closed });
      setBusy(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className={cn(item.status === "abierta" && "border-warning/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={item.student_name} size="xs" />
          <span className="truncate text-sm font-medium">{name}</span>
        </span>
        {item.class_topic && <span className="truncate text-xs text-muted">· {item.class_topic}</span>}
        <span className="ml-auto flex items-center gap-2">
          <Badge tone={meta.tone} dot size="sm">
            {meta.label}
          </Badge>
          <time dateTime={item.created_at} title={formatDateTime(item.created_at)} className="font-mono text-[11px] text-muted">
            {formatRelative(item.created_at)}
          </time>
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed">{item.question}</p>

      {item.ai_answer_md && (
        <details className="group mt-3 rounded-xl border border-accent-2/30 bg-accent-2/5">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm text-accent-2 marker:content-none">
            <Bot className="size-4 shrink-0" aria-hidden />
            Respuesta de la IA
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted group-open:hidden">ver</span>
          </summary>
          <div className="px-3 pb-3">
            <Markdown size="sm">{item.ai_answer_md}</Markdown>
          </div>
        </details>
      )}

      {/* El camino primario para responder: el chat con historial. Desde acá el
          trigger marca la consulta como respondida — la "respuesta destacada" de
          abajo queda para cuando amerita una explicación formal en Markdown. */}
      {!editing && item.status !== "cerrada" && (
        <div className="mt-3">
          <ConsultaThread
            questionId={item.id}
            messages={item.messages}
            viewerRole="docente"
            hideStudentName={item.is_anonymous}
          />
        </div>
      )}

      {item.teacher_answer_md && !editing && (
        <div className="mt-3 rounded-xl border border-success/30 bg-success/5 p-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-success">
            Respuesta del equipo docente
            {item.answered_by_name && ` · ${item.answered_by_name}`}
            {item.answered_at && ` · ${formatRelative(item.answered_at)}`}
          </p>
          <Markdown size="sm">{item.teacher_answer_md}</Markdown>
        </div>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`answer-${item.id}`} className="eyebrow">
            Tu respuesta (Markdown)
          </label>
          <Textarea
            id={`answer-${item.id}`}
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribí la respuesta que va a ver el estudiante…"
            maxLength={8000}
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {item.ai_answer_md && draft !== item.ai_answer_md && (
              <Button variant="ghost" size="sm" leftIcon={<Sparkles />} onClick={() => setDraft(item.ai_answer_md ?? "")} disabled={pending}>
                Usar la de la IA como base
              </Button>
            )}
            <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button size="sm" leftIcon={<Send />} onClick={submitAnswer} loading={pending && busy === "answer"} disabled={pending || draft.trim().length === 0}>
              Publicar respuesta
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
          {item.status !== "cerrada" && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={item.teacher_answer_md ? <Check /> : <Send />}
              onClick={() => startEditing(item.teacher_answer_md ?? item.ai_answer_md ?? "")}
              disabled={pending}
            >
              {item.teacher_answer_md ? "Editar respuesta destacada" : "Respuesta destacada"}
            </Button>
          )}
          <Switch
            size="sm"
            checked={item.is_public}
            onCheckedChange={togglePublic}
            disabled={pending}
            label="Pública para el curso"
            className="gap-2"
          />
          <span className="ml-auto">
            {item.status === "cerrada" ? (
              <Button size="sm" variant="ghost" leftIcon={<LockOpen />} onClick={() => toggleClosed(false)} loading={pending && busy === "closed"} disabled={pending}>
                Reabrir
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Lock />}
                onClick={() => toggleClosed(true)}
                loading={pending && busy === "closed"}
                disabled={pending}
                className="text-muted hover:text-foreground"
              >
                Cerrar
              </Button>
            )}
          </span>
        </div>
      )}

    </Card>
  );
}
