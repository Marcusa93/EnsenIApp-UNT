"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bot, EyeOff, MessageCirclePlus, RotateCcw, Send, Sparkles, Users } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle, Field, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { track } from "@/lib/telemetry";
import { errorMessage } from "@/lib/utils";
import { askQuestion, type AskQuestionInput } from "../actions";

export interface ClassOption {
  id: string;
  topic: string;
  class_date: string;
}

interface AskQuestionFormProps {
  courseId: string;
  classes: ClassOption[];
  initialClassId: string | null;
  initialRecordingId: string | null;
}

type AnswerState =
  | { phase: "idle" }
  | { phase: "answering"; id: string; question: string }
  | { phase: "answered"; id: string; question: string; answerMd: string }
  | { phase: "failed"; id: string; question: string; error: string };

const MIN_LEN = 12;
const MAX_LEN = 2000;

export function AskQuestionForm({ courseId, classes, initialClassId, initialRecordingId }: AskQuestionFormProps) {
  const router = useRouter();
  const validInitialClass = initialClassId && classes.some((c) => c.id === initialClassId) ? initialClassId : "";
  const [question, setQuestion] = React.useState("");
  const [classId, setClassId] = React.useState<string>(validInitialClass);
  const [recordingId] = React.useState<string | null>(validInitialClass ? initialRecordingId : null);
  const [anonymous, setAnonymous] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [questionError, setQuestionError] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState<AnswerState>({ phase: "idle" });
  const questionId = React.useId();
  const classSelectId = React.useId();

  const trimmedLen = question.trim().length;
  const canSubmit = trimmedLen >= MIN_LEN && trimmedLen <= MAX_LEN && !pending;

  async function requestAnswer(id: string, text: string) {
    setAnswer({ phase: "answering", id, question: text });
    try {
      const res = await fetch(`/api/questions/${id}/answer`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { answer_md?: string | null; error?: string };
      if (!res.ok || !body.answer_md) {
        setAnswer({
          phase: "failed",
          id,
          question: text,
          error: body.error ?? "La IA no pudo responder ahora. Tu consulta quedó registrada para el equipo docente.",
        });
      } else {
        setAnswer({ phase: "answered", id, question: text, answerMd: body.answer_md });
      }
    } catch (err) {
      console.error("[consultas] respuesta IA", err);
      setAnswer({
        phase: "failed",
        id,
        question: text,
        error: "No hay conexión con el servidor. Tu consulta quedó registrada; la respuesta va a aparecer en tu lista.",
      });
    } finally {
      router.refresh();
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setQuestionError(null);
    const text = question.trim();
    const input: AskQuestionInput = {
      courseId,
      question: text,
      classId: classId || null,
      recordingId: classId && recordingId ? recordingId : null,
      isAnonymous: anonymous,
      isPublic,
    };
    try {
      const result = await askQuestion(input);
      if (!result.ok) {
        setError(result.error);
        setQuestionError(result.fieldErrors?.question ?? null);
        return;
      }
      void track("question_asked", {
        entity_type: classId ? "class" : "course",
        entity_id: classId || courseId,
        metadata: { question_id: result.id, is_anonymous: anonymous, is_public: isPublic, has_recording: Boolean(input.recordingId) },
      });
      setQuestion("");
      setPending(false);
      await requestAnswer(result.id, text);
    } catch (err) {
      console.error("[consultas] askQuestion", err);
      setError(errorMessage(err, "No pudimos enviar tu consulta. Probá de nuevo."));
    } finally {
      setPending(false);
    }
  }

  const selectedClass = classes.find((c) => c.id === classId) ?? null;

  return (
    <Card id="nueva-consulta" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-accent opacity-[0.12] blur-3xl" aria-hidden />
      <div className="relative">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/12 text-accent">
            <MessageCirclePlus className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle as="h2" eyebrow="Hacer una consulta">
              ¿Qué no te quedó claro?
            </CardTitle>
            <CardDescription className="mt-0.5">
              La IA te responde al instante con el material de la clase y el equipo docente la ve para ampliar.
            </CardDescription>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {answer.phase === "idle" ? (
            <motion.form
              key="form"
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
              aria-busy={pending}
            >
              <Field
                label="Tu consulta"
                htmlFor={questionId}
                required
                error={questionError}
                hint={
                  <span className={`font-mono tabular-nums ${trimmedLen > MAX_LEN ? "text-danger" : ""}`}>
                    {trimmedLen}/{MAX_LEN}
                  </span>
                }
                description="Sé concreto: qué tema, qué parte te perdió, qué ejemplo no entendiste."
              >
                <Textarea
                  id={questionId}
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={MAX_LEN + 50}
                  invalid={Boolean(questionError)}
                  placeholder="Ej.: ¿cuál es la diferencia entre consentimiento informado y consentimiento para el tratamiento de datos personales?"
                  disabled={pending}
                />
              </Field>

              <Field
                label="Clase relacionada"
                htmlFor={classSelectId}
                hint={<span>opcional</span>}
                description={
                  selectedClass && recordingId
                    ? "La IA va a usar la grabación publicada de esta clase para responder."
                    : "Si la elegís, la IA responde con el resumen y la transcripción de esa clase."
                }
              >
                <Select
                  id={classSelectId}
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={pending || classes.length === 0}
                >
                  <option value="">{classes.length === 0 ? "Todavía no hay clases cargadas" : "Consulta general de la materia"}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_date.slice(8, 10)}/{c.class_date.slice(5, 7)} · {c.topic}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-3 rounded-xl border border-border bg-surface-2/50 p-3 sm:grid-cols-2">
                <Switch
                  checked={anonymous}
                  onCheckedChange={setAnonymous}
                  disabled={pending}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <EyeOff className="size-3.5 text-muted" aria-hidden /> Anónima para el docente
                    </span>
                  }
                  description="El equipo docente ve la consulta sin tu nombre."
                />
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  disabled={pending}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5 text-muted" aria-hidden /> Pública para compañeros
                    </span>
                  }
                  description="Aparece en “Consultas públicas del curso” con su respuesta."
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  {trimmedLen > 0 && trimmedLen < MIN_LEN ? `Un poco más de detalle (mínimo ${MIN_LEN} caracteres).` : "Enviá con Ctrl/⌘ + Enter."}
                </p>
                <Button type="submit" disabled={!canSubmit} loading={pending} rightIcon={<Send />} className="glow">
                  Enviar consulta
                </Button>
              </div>
              <KeyboardSubmit enabled={canSubmit} />
            </motion.form>
          ) : (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              aria-live="polite"
            >
              <blockquote className="rounded-xl border-l-2 border-accent bg-surface-2/60 px-4 py-3 text-sm">
                <span className="eyebrow mb-1 block">Tu consulta</span>
                <p className="whitespace-pre-line">{answer.question}</p>
              </blockquote>

              <div className="mt-4 rounded-2xl border border-accent-2/25 bg-accent-2/5 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg border border-accent-2/30 bg-accent-2/12 text-accent-2">
                    <Bot className="size-3.5" aria-hidden />
                  </span>
                  <span className="eyebrow text-accent-2">Respuesta de la IA</span>
                  {answer.phase === "answering" && (
                    <Badge tone="accent-2" size="sm" dot live>
                      respondiendo
                    </Badge>
                  )}
                </div>

                {answer.phase === "answering" && (
                  <div className="flex flex-col gap-2" role="status" aria-label="La IA está respondiendo">
                    <p className="mb-1 text-sm text-muted">La IA está leyendo el material de la clase para responderte…</p>
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-11/12" />
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="mt-2 h-3.5 w-2/3" />
                  </div>
                )}
                {answer.phase === "answered" && (
                  <Markdown size="sm" className="[&_h2]:text-base [&_h3]:text-sm">
                    {answer.answerMd}
                  </Markdown>
                )}
                {answer.phase === "failed" && (
                  <p role="alert" className="text-sm text-warning">
                    {answer.error}
                  </p>
                )}
              </div>

              {answer.phase !== "answering" && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Sparkles className="size-3.5 text-accent-3" aria-hidden />
                    El equipo docente puede ampliar o corregir esta respuesta: lo vas a ver en tu lista.
                  </p>
                  <div className="flex gap-2">
                    {answer.phase === "failed" && (
                      <Button size="sm" variant="secondary" onClick={() => requestAnswer(answer.id, answer.question)} leftIcon={<RotateCcw />}>
                        Reintentar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setAnswer({ phase: "idle" })} leftIcon={<MessageCirclePlus />}>
                      Hacer otra consulta
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

/** Ctrl/⌘ + Enter envía el formulario padre. */
function KeyboardSubmit({ enabled }: { enabled: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && enabled) {
        e.preventDefault();
        form.requestSubmit();
      }
    };
    form.addEventListener("keydown", onKey);
    return () => form.removeEventListener("keydown", onKey);
  }, [enabled]);
  return <span ref={ref} hidden />;
}
