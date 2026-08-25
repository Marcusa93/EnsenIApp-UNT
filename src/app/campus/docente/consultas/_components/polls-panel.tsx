"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, MessageSquareQuote, Play, Plus, Square, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
  type BadgeTone,
} from "@/components/ui";
import { formatDate, formatPercent, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createPoll, deletePoll, setPollStatus } from "../actions";
import type { PollItem, PollStatus } from "./consultas-data";

const STATUS_META: Record<PollStatus, { label: string; tone: BadgeTone; live?: boolean }> = {
  draft: { label: "Borrador", tone: "muted" },
  open: { label: "Abierta", tone: "success", live: true },
  closed: { label: "Cerrada", tone: "muted" },
};

export interface PollsPanelProps {
  courseId: string;
  polls: PollItem[];
  classes: { id: string; topic: string; class_date: string }[];
  enrolledCount: number;
  /** Clase precargada al crear (llega por ?classId= desde la vista de la clase). */
  initialClassId?: string;
}

export function PollsPanel({ courseId, polls, classes, enrolledCount, initialClassId }: PollsPanelProps) {
  const router = useRouter();
  const validInitialClass = initialClassId && classes.some((c) => c.id === initialClassId) ? initialClassId : "";
  const [createOpen, setCreateOpen] = React.useState(Boolean(validInitialClass) && polls.length === 0);
  const [error, setError] = React.useState<string | null>(null);

  const hasOpen = polls.some((p) => p.status === "open");

  // Resultados en vivo sin Realtime: mientras haya una encuesta abierta,
  // refrescamos los datos del servidor cada 10 s (sólo con la pestaña visible).
  React.useEffect(() => {
    if (!hasOpen) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [hasOpen, router]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Preguntas rápidas para tomar el pulso en clase. Con una encuesta abierta, los resultados se actualizan solos
          cada 10 segundos.
        </p>
        <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
          Nueva encuesta
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {polls.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          tone="accent"
          title="Todavía no hay encuestas"
          description="Creá una encuesta con opciones o respuesta libre y abrila durante la clase para ver los resultados en vivo."
          action={
            <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
              Crear la primera
            </Button>
          }
        />
      ) : (
        <ul className="stagger grid gap-4 xl:grid-cols-2">
          {polls.map((p) => (
            <li key={p.id}>
              <PollCard poll={p} enrolledCount={enrolledCount} onError={setError} />
            </li>
          ))}
        </ul>
      )}

      <CreatePollDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        courseId={courseId}
        classes={classes}
        initialClassId={validInitialClass}
      />
    </div>
  );
}

function PollCard({ poll, enrolledCount, onError }: { poll: PollItem; enrolledCount: number; onError: (m: string | null) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState<"status" | "delete" | null>(null);
  const meta = STATUS_META[poll.status];
  const totalVotes = poll.options.reduce((t, o) => t + o.votes, 0);
  const leader = Math.max(0, ...poll.options.map((o) => o.votes));

  const changeStatus = (status: "open" | "closed") => {
    setBusy("status");
    onError(null);
    startTransition(async () => {
      const res = await setPollStatus({ poll_id: poll.id, status });
      setBusy(null);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const remove = () => {
    const warn =
      poll.responses > 0
        ? `¿Eliminar la encuesta y sus ${poll.responses} respuestas? Esta acción no se puede deshacer.`
        : "¿Eliminar la encuesta? Esta acción no se puede deshacer.";
    if (!window.confirm(warn)) return;
    setBusy("delete");
    onError(null);
    startTransition(async () => {
      const res = await deletePoll({ poll_id: poll.id });
      setBusy(null);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className={cn("flex h-full flex-col gap-4", poll.status === "open" && "border-success/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{poll.question}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted">
            {formatRelative(poll.created_at)}
            {poll.class_topic && ` · ${poll.class_topic}`}
          </p>
        </div>
        <Badge tone={meta.tone} dot live={meta.live}>
          {meta.label}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold text-accent-2">{poll.responses}</span>
        <span className="text-sm text-muted">
          {poll.responses === 1 ? "respuesta" : "respuestas"}
          {enrolledCount > 0 && ` · ${formatPercent(poll.responses / enrolledCount)} del curso`}
        </span>
      </div>

      {poll.options.length > 0 && (
        <ol className="flex flex-col gap-2.5" aria-label="Resultados por opción">
          {poll.options.map((o, i) => {
            const share = totalVotes > 0 ? o.votes / totalVotes : 0;
            const isLeader = totalVotes > 0 && o.votes === leader;
            return (
              <li key={i}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={cn("min-w-0 truncate", isLeader ? "font-medium" : "text-foreground/90")}>{o.label}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {o.votes} · {formatPercent(share)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="presentation">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      isLeader ? "bg-accent-2" : "bg-accent/60",
                    )}
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {poll.allow_free_text && (
        <div className="rounded-xl border border-border bg-surface-2/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            <MessageSquareQuote className="size-3.5" aria-hidden />
            Respuestas libres ({poll.free_texts.length})
          </p>
          {poll.free_texts.length === 0 ? (
            <p className="text-sm text-muted">Todavía no llegaron respuestas libres.</p>
          ) : (
            <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
              {poll.free_texts.map((t, i) => (
                <li key={i} className="border-l-2 border-accent-3/50 pl-2.5 text-sm text-foreground/90">
                  “{t}”
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {poll.status !== "open" ? (
          <Button size="sm" leftIcon={<Play />} onClick={() => changeStatus("open")} loading={pending && busy === "status"} disabled={pending}>
            {poll.status === "draft" ? "Abrir" : "Reabrir"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" leftIcon={<Square />} onClick={() => changeStatus("closed")} loading={pending && busy === "status"} disabled={pending}>
            Cerrar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Trash2 />}
          onClick={remove}
          loading={pending && busy === "delete"}
          disabled={pending}
          className="ml-auto text-muted hover:text-danger"
        >
          Eliminar
        </Button>
      </div>
    </Card>
  );
}

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  classes: { id: string; topic: string; class_date: string }[];
  initialClassId: string;
}

function CreatePollDialog({ open, onOpenChange, courseId, classes, initialClassId }: CreatePollDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState<string[]>(["", ""]);
  const [allowFree, setAllowFree] = React.useState(false);
  const [classId, setClassId] = React.useState(initialClassId);
  const [openNow, setOpenNow] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const setOption = (i: number, value: string) => setOptions((prev) => prev.map((o, j) => (j === i ? value : o)));
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, j) => j !== i));

  const submit = () => {
    const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    setError(null);
    startTransition(async () => {
      const res = await createPoll({
        course_id: courseId,
        class_id: classId || null,
        question: question.trim(),
        options: cleanOptions,
        allow_free_text: allowFree,
        open_now: openNow,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      setQuestion("");
      setOptions(["", ""]);
      setAllowFree(false);
      setClassId(initialClassId);
      setOpenNow(true);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva encuesta"
      description="Una pregunta corta con opciones, respuesta libre o ambas. La podés abrir ahora o dejarla lista en borrador."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={pending} leftIcon={openNow ? <Play /> : <Plus />}>
            {openNow ? "Crear y abrir" : "Guardar borrador"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Pregunta" htmlFor="poll-question" required>
          <Textarea
            id="poll-question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Qué tema te gustaría repasar la próxima clase?"
            maxLength={500}
            required
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="eyebrow mb-1">Opciones</legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Opción ${i + 1}`}
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                maxLength={200}
              />
              {options.length > 2 && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar la opción ${i + 1}`} onClick={() => removeOption(i)} disabled={pending}>
                  <X />
                </Button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus />} onClick={() => setOptions((prev) => [...prev, ""])} disabled={pending} className="self-start">
              Agregar opción
            </Button>
          )}
          <p className="text-xs text-muted">Dejá todas las opciones vacías si querés una encuesta sólo de respuesta libre.</p>
        </fieldset>

        <Switch
          checked={allowFree}
          onCheckedChange={setAllowFree}
          label="Permitir respuesta libre"
          description="Además de (o en lugar de) las opciones, el estudiante puede escribir."
          disabled={pending}
        />

        <Field label="Clase asociada" htmlFor="poll-class" hint="Opcional">
          <Select
            id="poll-class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={pending}
          >
            <option value="">Sin clase asociada</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {formatDate(c.class_date)} · {c.topic}
              </option>
            ))}
          </Select>
        </Field>

        <Switch
          checked={openNow}
          onCheckedChange={setOpenNow}
          label="Abrir al crear"
          description="Si la dejás en borrador, los estudiantes no la ven hasta que la abras."
          disabled={pending}
        />

        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="sr-only">
          Crear encuesta
        </button>
      </form>
    </Dialog>
  );
}
