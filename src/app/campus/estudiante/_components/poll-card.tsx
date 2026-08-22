"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, CloudOff, Vote } from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { enqueue, isOnline, track } from "@/lib/telemetry";
import type { TablesInsert } from "@/lib/types/helpers";
import { cn, errorMessage } from "@/lib/utils";

export interface OpenPoll {
  id: string;
  question: string;
  options: string[];
  allow_free_text: boolean;
  closes_at: string | null;
}

function looksLikeNetworkError(err: unknown): boolean {
  return /fetch|network|load failed|timeout|ECONN|abort/i.test(errorMessage(err, ""));
}

/** Encuesta rápida del docente, respondible inline. Offline: se encola y se confirma localmente. */
export function PollCard({ poll, studentId }: { poll: OpenPoll; studentId: string }) {
  const router = useRouter();
  const [choice, setChoice] = React.useState<number | null>(null);
  const [freeText, setFreeText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ queued: boolean } | null>(null);
  const textId = React.useId();

  const canSubmit = choice != null || (poll.allow_free_text && freeText.trim().length > 0);

  async function submit() {
    if (!canSubmit || pending) return;
    setPending(true);
    setError(null);
    const row: TablesInsert<"poll_responses"> = {
      poll_id: poll.id,
      student_id: studentId,
      option_index: choice,
      free_text: poll.allow_free_text && freeText.trim() ? freeText.trim() : null,
    };
    try {
      let queued = false;
      if (!isOnline()) {
        enqueue({ table: "poll_responses", op: "insert", payload: row, key: `poll:${poll.id}` });
        queued = true;
      } else {
        const supabase = createClient();
        const { error: insertError } = await supabase.from("poll_responses").insert(row);
        if (insertError) {
          if (insertError.code === "23505") {
            // Ya respondida (p. ej. desde otro dispositivo)
            setDone({ queued: false });
            router.refresh();
            return;
          }
          if (looksLikeNetworkError(insertError) || !insertError.code) {
            enqueue({ table: "poll_responses", op: "insert", payload: row, key: `poll:${poll.id}` });
            queued = true;
          } else {
            console.error("[poll] insert rechazado", { pollId: poll.id, error: insertError });
            setError(
              insertError.code === "42501"
                ? "La encuesta ya se cerró o no estás inscripto en esta comisión."
                : "No pudimos registrar tu respuesta. Probá de nuevo.",
            );
            return;
          }
        }
      }
      void track("poll_answered", {
        entity_type: "poll",
        entity_id: poll.id,
        metadata: { option_index: choice, has_free_text: Boolean(row.free_text), queued },
      });
      setDone({ queued });
    } catch (err) {
      console.error("[poll] fallo inesperado", err);
      setError(errorMessage(err, "No pudimos registrar tu respuesta."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="relative overflow-hidden border-accent-2/30">
      <div className="pointer-events-none absolute -left-10 -top-10 size-36 rounded-full bg-accent-2 opacity-[0.12] blur-3xl" aria-hidden />
      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="accent-2" size="sm" dot live>
            Encuesta abierta
          </Badge>
          {poll.closes_at && (
            <span className="font-mono text-[11px] text-muted">cierra {formatRelative(poll.closes_at)}</span>
          )}
        </div>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent-2/30 bg-accent-2/12 text-accent-2">
            <Vote className="size-4" aria-hidden />
          </span>
          <h2 className="text-base font-semibold leading-snug sm:text-lg">{poll.question}</h2>
        </div>

        {done ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="mt-4 flex items-center gap-2 text-sm text-success"
          >
            {done.queued ? <CloudOff className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {done.queued
              ? "Respuesta guardada: se enviará cuando vuelva la conexión."
              : "¡Gracias! Tu respuesta quedó registrada."}
          </motion.p>
        ) : (
          <>
            {poll.options.length > 0 && (
              <div role="radiogroup" aria-label="Opciones" className="mt-4 grid gap-2 sm:grid-cols-2">
                {poll.options.map((opt, i) => {
                  const active = choice === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setChoice(active ? null : i)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active
                          ? "border-accent-2 bg-accent-2/12 text-foreground"
                          : "border-border bg-surface-2/50 text-muted hover:border-accent-2/50 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
                          active ? "border-accent-2 bg-accent-2 text-background" : "border-border",
                        )}
                        aria-hidden
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {poll.allow_free_text && (
              <div className="mt-3">
                <label htmlFor={textId} className="eyebrow mb-1.5 block">
                  {poll.options.length > 0 ? "Comentario (opcional)" : "Tu respuesta"}
                </label>
                <Textarea
                  id={textId}
                  rows={2}
                  maxLength={800}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Escribí tu respuesta…"
                />
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-xs text-danger">
                {error}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">Sólo el equipo docente ve las respuestas.</p>
              <Button size="sm" onClick={submit} disabled={!canSubmit} loading={pending} leftIcon={<Check />}>
                Responder
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
