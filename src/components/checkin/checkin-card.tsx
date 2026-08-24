"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, CloudOff, Sparkles } from "lucide-react";
import { Button, Card, CardDescription, CardTitle, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { enqueue, isOnline, track } from "@/lib/telemetry";
import type { TablesInsert } from "@/lib/types/helpers";
import { cn, errorMessage } from "@/lib/utils";

export interface CheckinCardProps {
  classId: string;
  /** Id del estudiante autenticado (evita una consulta extra). Si falta, se resuelve desde la sesión. */
  studentId?: string;
  classTopic?: string | null;
  /** Se llama después de registrar (online o encolado). */
  onSubmitted?: (result: { difficulty: number; queued: boolean }) => void;
  className?: string;
}

const LEVELS: { value: number; label: string; emoji: string }[] = [
  { value: 1, label: "Muy fácil", emoji: "😎" },
  { value: 2, label: "Fácil", emoji: "🙂" },
  { value: 3, label: "Normal", emoji: "😐" },
  { value: 4, label: "Difícil", emoji: "😓" },
  { value: 5, label: "Muy difícil", emoji: "🤯" },
];

const storageKey = (classId: string) => `ensenia.checkin.${classId}`;

function readStored(classId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(classId));
  } catch {
    return null;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function looksLikeNetworkError(err: unknown): boolean {
  const msg = errorMessage(err, "");
  return /fetch|network|load failed|timeout|ECONN|abort/i.test(msg);
}

/**
 * Check-in de dificultad (1–5 + comentario) para una clase. Resiliente offline:
 * si no hay red o el insert falla por red, se encola en la cola offline y se marca como hecho localmente.
 */
export function CheckinCard({ classId, studentId, classTopic, onSubmitted, className }: CheckinCardProps) {
  const [difficulty, setDifficulty] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<{ queued: boolean } | null>(null);
  const commentId = React.useId();

  // Check-in ya hecho en este dispositivo (localStorage), sin setState en efectos.
  const storedAt = React.useSyncExternalStore(
    subscribeStorage,
    () => readStored(classId),
    () => null,
  );
  const done = submitted ?? (storedAt ? { queued: false } : null);
  const setDone = setSubmitted;

  async function resolveStudentId(): Promise<string | null> {
    if (studentId) return studentId;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  }

  async function submit() {
    if (difficulty == null || pending) return;
    setPending(true);
    setError(null);
    try {
      const uid = await resolveStudentId();
      if (!uid) {
        setError("Tu sesión venció. Volvé a ingresar para registrar el check-in.");
        return;
      }
      const row: TablesInsert<"student_checkins"> = {
        student_id: uid,
        class_id: classId,
        difficulty,
        comment: comment.trim() || null,
      };
      let queued = false;
      if (!isOnline()) {
        enqueue({ table: "student_checkins", op: "insert", payload: row, key: `checkin:${classId}` });
        queued = true;
      } else {
        const supabase = createClient();
        const { error: insertError } = await supabase.from("student_checkins").insert(row);
        if (insertError) {
          if (looksLikeNetworkError(insertError) || !insertError.code) {
            enqueue({ table: "student_checkins", op: "insert", payload: row, key: `checkin:${classId}` });
            queued = true;
          } else {
            console.error("[checkin] insert rechazado", { classId, error: insertError });
            setError("No pudimos guardar tu check-in. Probá de nuevo en unos segundos.");
            return;
          }
        }
      }
      try {
        window.localStorage.setItem(storageKey(classId), new Date().toISOString());
      } catch {
        /* ignorar */
      }
      void track("checkin_submitted", {
        entity_type: "class",
        entity_id: classId,
        metadata: { difficulty, has_comment: Boolean(comment.trim()), queued },
      });
      setDone({ queued });
      onSubmitted?.({ difficulty, queued });
    } catch (err) {
      console.error("[checkin] fallo inesperado", err);
      setError(errorMessage(err, "No pudimos guardar tu check-in."));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card className={cn("relative overflow-hidden", className)} padding="sm" role="status">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-success/30 bg-success/12 text-success">
            {done.queued ? <CloudOff className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Gracias por tu check-in</p>
            <p className="text-xs text-muted">
              {done.queued
                ? "Estás sin conexión: lo guardamos y se enviará solo cuando vuelva la red."
                : "Tu devolución ayuda al equipo docente a ajustar la próxima clase."}
            </p>
          </div>
        </motion.div>
      </Card>
    );
  }

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent-3 opacity-[0.12] blur-3xl" aria-hidden />
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent-3/30 bg-accent-3/12 text-accent-3">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <CardTitle eyebrow="Check-in rápido">¿Qué tan difícil te resultó la clase?</CardTitle>
          {classTopic && <CardDescription className="mt-0.5 truncate">{classTopic}</CardDescription>}
        </div>
      </div>

      <div role="radiogroup" aria-label="Nivel de dificultad" className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {LEVELS.map((lvl) => {
          const active = difficulty === lvl.value;
          return (
            <motion.button
              key={lvl.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${lvl.value}: ${lvl.label}`}
              onClick={() => setDifficulty(lvl.value)}
              whileTap={{ scale: 0.94 }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:py-3",
                active
                  ? "border-accent bg-accent/15 text-foreground shadow-[0_0_0_1px_var(--accent)]"
                  : "border-border bg-surface-2/60 text-muted hover:border-accent/50 hover:text-foreground",
              )}
            >
              <span className="text-lg leading-none sm:text-xl" aria-hidden>
                {lvl.emoji}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider">{lvl.value}</span>
              <span className="hidden text-[11px] leading-tight sm:block">{lvl.label}</span>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={false}
        animate={{ height: difficulty == null ? 0 : "auto", opacity: difficulty == null ? 0 : 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <div className="pt-4">
          <label htmlFor={commentId} className="eyebrow mb-1.5 block">
            ¿Qué te costó? <span className="normal-case tracking-normal text-muted">(opcional)</span>
          </label>
          <Textarea
            id={commentId}
            rows={2}
            maxLength={600}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ej.: me perdí en la parte de consentimiento informado"
          />
        </div>
      </motion.div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Anónimo para tus compañeros. El docente lo ve para ajustar la cursada.</p>
        <Button size="sm" onClick={submit} disabled={difficulty == null} loading={pending} leftIcon={<Check />}>
          Enviar
        </Button>
      </div>
    </Card>
  );
}
