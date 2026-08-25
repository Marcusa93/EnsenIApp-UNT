"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BookOpenCheck, CloudOff, CloudUpload, FileUp, Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, Dialog, Field, Progress, Switch, Textarea } from "@/components/ui";
import { cn, errorMessage } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import type { Json } from "@/lib/types/database";
import { enqueue, ensureAutoFlush, track, useFocusTracking } from "@/lib/telemetry";
import {
  parseEssayAnswers,
  parseQuizAnswers,
  parseReadingAnswers,
  type EditableType,
  type EssayAnswers,
  type QuizAnswers,
  type ReadingAnswers,
  type SubmissionStatus,
} from "@/components/activities/model";
import { saveProgress, submitActivity } from "../actions";

export interface ActivityRunnerProps {
  activityId: string;
  type: EditableType;
  studentId: string;
  maxScore: number;
  /** Preguntas SIN respuesta correcta (se corrige server-side). */
  quizQuestions: { id: string; prompt: string; options: string[] }[] | null;
  allowFileUpload: boolean;
  initialAnswers: Json | null;
  initialTimeSpent: number;
  initialStatus: SubmissionStatus | null;
  reopened: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "queued" | "error";

const AUTOSAVE_DEBOUNCE_MS = 2500;
const HEARTBEAT_MS = 30_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function ActivityRunner(props: ActivityRunnerProps) {
  const { activityId, type, studentId } = props;
  const router = useRouter();

  const [reading, setReading] = React.useState<ReadingAnswers>(() => parseReadingAnswers(props.initialAnswers));
  const [quiz, setQuiz] = React.useState<QuizAnswers>(() => parseQuizAnswers(props.initialAnswers));
  const [essay, setEssay] = React.useState<EssayAnswers>(() => parseEssayAnswers(props.initialAnswers));

  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Tiempo dedicado: acumulado total (arranca en lo ya registrado) mientras la pestaña está visible.
  const timeRef = React.useRef(props.initialTimeSpent);
  const startedRef = React.useRef(props.initialStatus !== null);
  const dirtyRef = React.useRef(false);
  const savingRef = React.useRef(false);
  const debounceRef = React.useRef<number | null>(null);

  const currentAnswers = React.useCallback((): ReadingAnswers | QuizAnswers | EssayAnswers => {
    if (type === "lectura") return reading;
    if (type === "cuestionario") return quiz;
    return essay;
  }, [type, reading, quiz, essay]);
  const answersRef = React.useRef(currentAnswers());
  React.useEffect(() => {
    answersRef.current = currentAnswers();
  }, [currentAnswers]);

  useFocusTracking("activity", activityId);
  React.useEffect(() => {
    void track("activity_viewed", { entity_type: "activity", entity_id: activityId });
  }, [activityId]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") timeRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const doSave = React.useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    dirtyRef.current = false;
    setSaveState("saving");
    const payload = { activityId, answers: answersRef.current, timeSpentSeconds: timeRef.current };
    try {
      const res = await saveProgress(payload);
      if (res.ok) {
        setSaveState("saved");
        setSavedAt(new Date());
        setError(null);
      } else {
        setSaveState("error");
        setError(res.error);
      }
    } catch {
      // Sin red (o el server no respondió): a la cola offline; se sube al reconectar.
      enqueue({
        table: "activity_submissions",
        op: "upsert",
        payload: {
          activity_id: activityId,
          student_id: studentId,
          answers: answersRef.current as unknown as Json,
          time_spent_seconds: timeRef.current,
          status: props.initialStatus ?? "en_progreso",
        },
        key: `submission:${activityId}`,
        onConflict: "activity_id,student_id",
      });
      ensureAutoFlush();
      setSaveState("queued");
      setSavedAt(new Date());
    } finally {
      savingRef.current = false;
    }
  }, [activityId, studentId, props.initialStatus]);

  /** Marca cambios: dispara activity_started la primera vez y programa el autosave. */
  const markChanged = React.useCallback(() => {
    setError(null);
    if (!startedRef.current) {
      startedRef.current = true;
      void track("activity_started", { entity_type: "activity", entity_id: activityId });
    }
    dirtyRef.current = true;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void track("activity_answer_changed", { entity_type: "activity", entity_id: activityId });
      void doSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [activityId, doSave]);

  // Latido: persiste el tiempo dedicado aunque no haya cambios nuevos.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (startedRef.current && !dirtyRef.current) void doSave();
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [doSave]);

  // Al ocultar la pestaña, guardar lo que haya (best-effort).
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && startedRef.current) void doSave();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [doSave]);

  const answeredCount = props.quizQuestions
    ? props.quizQuestions.filter((q) => quiz.choices[q.id] !== undefined).length
    : 0;
  const totalQuestions = props.quizQuestions?.length ?? 0;

  const readyToSubmit =
    type === "lectura"
      ? reading.read
      : type === "cuestionario"
        ? totalQuestions > 0 && answeredCount === totalQuestions
        : essay.text.trim().length > 0 || Boolean(essay.file_path);

  const submitHint =
    type === "lectura"
      ? "Marcá la lectura como leída para poder entregar."
      : type === "cuestionario"
        ? `Respondé las ${totalQuestions - answeredCount} que faltan para poder entregar.`
        : "Escribí tu entrega (o adjuntá un archivo) para poder entregar.";

  const submit = () => {
    startTransition(async () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      const res = await submitActivity({ activityId, answers: answersRef.current, timeSpentSeconds: timeRef.current });
      if (!res.ok) {
        setConfirmOpen(false);
        setError(res.error);
        return;
      }
      void track("activity_submitted", {
        entity_type: "activity",
        entity_id: activityId,
        metadata: { auto_score: res.data.autoScore, time_spent_seconds: timeRef.current },
      });
      setConfirmOpen(false);
      router.refresh();
    });
  };

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError("El archivo supera los 10 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("activityId", activityId);
      form.set("file", file);
      const res = await fetch("/api/submissions/upload", { method: "POST", body: form });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : null;
        throw new Error(msg ?? `No se pudo subir el archivo (HTTP ${res.status}).`);
      }
      const data = json as { file_path: string; file_name: string };
      setEssay((e) => ({ ...e, file_path: data.file_path, file_name: data.file_name }));
      markChanged();
    } catch (err) {
      setError(errorMessage(err, "No se pudo subir el archivo. Probá de nuevo."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card highlight className="flex flex-col gap-5">
        <CardHeader className="mb-0 flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle eyebrow={props.reopened ? "Entrega reabierta" : "Tu entrega"}>
            {type === "lectura" ? "Registrá tu lectura" : type === "cuestionario" ? "Respondé el cuestionario" : "Escribí tu entrega"}
          </CardTitle>
          <SaveIndicator state={saveState} savedAt={savedAt} />
        </CardHeader>

        {props.reopened && (
          <p className="rounded-xl border border-accent-3/30 bg-accent-3/10 px-3 py-2 text-xs text-accent-3">
            El equipo docente reabrió tu entrega para que la revises y vuelvas a entregar.
          </p>
        )}

        {/* LECTURA */}
        {type === "lectura" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface-2/40 p-4">
              <Switch
                checked={reading.read}
                onCheckedChange={(read) => {
                  setReading((r) => ({ ...r, read }));
                  markChanged();
                }}
                label="Ya leí el texto y los materiales"
                description="Con esto alcanza para entregar. La reflexión es opcional pero suma."
              />
            </div>
            <Field
              label="Reflexión breve"
              htmlFor="run-reflection"
              hint="opcional"
              description="¿Qué te llevás de la lectura? ¿Qué no te quedó claro?"
            >
              <Textarea
                id="run-reflection"
                rows={5}
                maxLength={5000}
                value={reading.reflection}
                onChange={(e) => {
                  const reflection = e.target.value;
                  setReading((r) => ({ ...r, reflection }));
                  markChanged();
                }}
                placeholder="Escribí acá tu reflexión…"
                disabled={pending}
              />
            </Field>
          </div>
        )}

        {/* CUESTIONARIO */}
        {type === "cuestionario" && props.quizQuestions && (
          <div className="flex flex-col gap-4">
            <Progress
              value={totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}
              tone="accent-2"
              label={`Respondiste ${answeredCount} de ${totalQuestions}`}
              size="sm"
            />
            <ol className="flex flex-col gap-4">
              {props.quizQuestions.map((q, i) => {
                const chosen = quiz.choices[q.id];
                return (
                  <li key={q.id} className="rounded-2xl border border-border bg-surface-2/40 p-4">
                    <p className="mb-3 text-sm font-medium leading-relaxed">
                      <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                      {q.prompt}
                    </p>
                    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`Opciones de la pregunta ${i + 1}`}>
                      {q.options.map((opt, oi) => {
                        const active = chosen === oi;
                        return (
                          <button
                            key={oi}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={pending}
                            onClick={() => {
                              setQuiz((a) => ({ choices: { ...a.choices, [q.id]: oi } }));
                              markChanged();
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                              active
                                ? "border-accent bg-accent/10 text-foreground"
                                : "border-border bg-surface hover:border-accent/50",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs",
                                active ? "border-accent bg-accent/20 text-accent" : "border-border text-muted",
                              )}
                            >
                              {LETTERS[oi]}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-muted">
              Las respuestas correctas y las explicaciones se muestran después de entregar.
            </p>
          </div>
        )}

        {/* ENTREGA */}
        {type === "entrega" && (
          <div className="flex flex-col gap-4">
            <Field
              label="Tu trabajo"
              htmlFor="run-essay"
              hint="Markdown"
              description="Podés escribir con títulos, listas y citas. Se guarda solo mientras escribís."
            >
              <Textarea
                id="run-essay"
                rows={14}
                maxLength={60_000}
                value={essay.text}
                onChange={(e) => {
                  const text = e.target.value;
                  setEssay((a) => ({ ...a, text }));
                  markChanged();
                }}
                placeholder="Desarrollá acá tu respuesta a la consigna…"
                disabled={pending}
                className="font-[inherit] leading-relaxed"
              />
            </Field>

            {props.allowFileUpload && (
              <div>
                <span className="eyebrow">Archivo adjunto</span>
                {essay.file_path ? (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm">
                    <Paperclip className="size-4 shrink-0 text-accent-2" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{essay.file_name ?? "Archivo adjunto"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-danger hover:text-danger"
                      aria-label="Quitar el adjunto"
                      disabled={uploading || pending}
                      onClick={() => {
                        setEssay((a) => ({ ...a, file_path: null, file_name: null }));
                        markChanged();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    className={cn(
                      "mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2/30 px-4 py-6 text-center text-sm text-muted transition-colors hover:border-accent/60 hover:text-foreground",
                      uploading && "pointer-events-none opacity-60",
                    )}
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
                    <span>{uploading ? "Subiendo…" : "Tocá para adjuntar un archivo"}</span>
                    <span className="font-mono text-[11px] uppercase tracking-widest">PDF · Word · imagen · hasta 10 MB</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.odt,.txt,image/png,image/jpeg,image/webp"
                      disabled={uploading || pending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadFile(file);
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            <X className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted">{readyToSubmit ? "Cuando entregues, ya no vas a poder editarla." : submitHint}</p>
          <Button
            type="button"
            leftIcon={<Send />}
            loading={pending}
            disabled={!readyToSubmit || uploading}
            onClick={() => setConfirmOpen(true)}
            className="glow"
          >
            Entregar
          </Button>
        </div>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => !o && !pending && setConfirmOpen(false)}
        title="¿Entregar la actividad?"
        description={
          type === "cuestionario"
            ? "Se corrige automáticamente al entregar y no vas a poder cambiar tus respuestas."
            : "Después de entregar no vas a poder editarla, salvo que el equipo docente la reabra."
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Seguir editando
            </Button>
            <Button leftIcon={<BookOpenCheck />} loading={pending} onClick={submit}>
              Entregar
            </Button>
          </>
        }
      />
    </motion.div>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  if (state === "idle") return null;
  const base = "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest";
  if (state === "saving") {
    return (
      <span className={cn(base, "text-muted")} role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Guardando…
      </span>
    );
  }
  if (state === "queued") {
    return (
      <span className={cn(base, "text-warning")} role="status">
        <CloudOff className="size-3.5" aria-hidden /> Sin conexión: guardado local
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className={cn(base, "text-danger")} role="status">
        <X className="size-3.5" aria-hidden /> No se pudo guardar
      </span>
    );
  }
  return (
    <span className={cn(base, "text-success")} role="status">
      <CloudUpload className="size-3.5" aria-hidden /> Guardado {savedAt ? formatTime(savedAt) : ""}
    </span>
  );
}
