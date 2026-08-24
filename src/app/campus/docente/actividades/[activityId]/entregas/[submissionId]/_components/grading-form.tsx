"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCheck, RotateCcw, Save, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardHeader, CardTitle, Field, Input, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { errorMessage } from "@/lib/utils";
import type { SubmissionStatus } from "@/components/activities/model";
import { gradeSubmission, reopenSubmission } from "../../../../actions";

export interface GradingFormProps {
  submissionId: string;
  activityId: string;
  status: SubmissionStatus;
  maxScore: number;
  initialScore: number | null;
  autoScore: number | null;
  initialFeedback: string;
  aiFeedback: string | null;
}

export function GradingForm(props: GradingFormProps) {
  const router = useRouter();
  const [score, setScore] = React.useState(props.initialScore != null ? String(props.initialScore) : "");
  const [feedback, setFeedback] = React.useState(props.initialFeedback);
  const [ai, setAi] = React.useState<string | null>(props.aiFeedback);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const parsedScore = score.trim() === "" ? null : Number(score.replace(",", "."));
  const scoreInvalid = parsedScore != null && (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > props.maxScore);

  const save = (markGraded: boolean) => {
    if (scoreInvalid) {
      setError(`El puntaje debe estar entre 0 y ${props.maxScore}.`);
      return;
    }
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await gradeSubmission({
        submissionId: props.submissionId,
        score: parsedScore,
        teacher_feedback_md: feedback,
        markGraded,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(markGraded ? "Entrega marcada como corregida." : "Corrección guardada.");
      router.refresh();
    });
  };

  const reopen = () => {
    setError(null);
    startTransition(async () => {
      const res = await reopenSubmission(props.submissionId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  const suggest = async () => {
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submissions/${props.submissionId}/ai-feedback`, { method: "POST" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : null;
        throw new Error(msg ?? `No se pudo generar el feedback (HTTP ${res.status}).`);
      }
      const text = json && typeof json === "object" && "feedback_md" in json ? String((json as { feedback_md: unknown }).feedback_md) : "";
      if (!text) throw new Error("La IA devolvió un feedback vacío.");
      setAi(text);
      if (!feedback.trim()) setFeedback(text);
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar el feedback."));
    } finally {
      setAiLoading(false);
    }
  };

  const graded = props.status === "corregida";

  return (
    <Card className="flex flex-col gap-4 lg:sticky lg:top-20">
      <CardHeader className="mb-0 flex-row items-start justify-between gap-3">
        <div>
          <CardTitle eyebrow="Corrección">Puntaje y feedback</CardTitle>
        </div>
        {props.autoScore != null && (
          <Badge tone="accent-2" size="sm">
            auto {props.autoScore} / {props.maxScore}
          </Badge>
        )}
      </CardHeader>

      <Field
        label="Puntaje"
        htmlFor="grade-score"
        hint={`máx. ${props.maxScore}`}
        error={scoreInvalid ? `Entre 0 y ${props.maxScore}.` : null}
        description={props.autoScore != null ? "Si lo dejás vacío, vale el puntaje automático." : "Opcional."}
      >
        <Input
          id="grade-score"
          type="number"
          inputMode="decimal"
          min={0}
          max={props.maxScore}
          step="0.25"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          invalid={scoreInvalid}
          className="font-mono"
          disabled={pending}
        />
      </Field>

      <div className="flex flex-col">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="grade-feedback" className="eyebrow text-foreground/80">
            Feedback para el estudiante
          </label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)} disabled={!feedback.trim()}>
              {preview ? "Editar" : "Vista previa"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Sparkles />}
              loading={aiLoading}
              onClick={suggest}
              disabled={pending}
              className="border-accent-2/40 text-accent-2 hover:border-accent-2"
            >
              Sugerir con IA
            </Button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-40 rounded-xl border border-border bg-surface-2/40 p-4">
            <Markdown size="sm">{feedback}</Markdown>
          </div>
        ) : (
          <Textarea
            id="grade-feedback"
            rows={10}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Qué estuvo bien, qué corregir, cómo seguir…"
            disabled={pending}
          />
        )}
        <p className="mt-1.5 text-xs text-muted">Markdown. El estudiante lo ve cuando marcás la entrega como corregida.</p>
      </div>

      <AnimatePresence>
        {ai && ai !== feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-accent-2/30 bg-accent-2/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="eyebrow text-accent-2">Sugerencia de la IA</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFeedback(ai)} disabled={pending}>
                  Usar este texto
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <Markdown size="sm">{ai}</Markdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-xs text-success" role="status">
          {saved}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" leftIcon={<Save />} loading={pending} onClick={() => save(false)}>
          Guardar
        </Button>
        {!graded && (
          <Button type="button" leftIcon={<CheckCheck />} loading={pending} onClick={() => save(true)}>
            Marcar corregida
          </Button>
        )}
        {props.status !== "en_progreso" && props.status !== "reabierta" && (
          <Button type="button" variant="ghost" leftIcon={<RotateCcw />} disabled={pending} onClick={reopen} className="ml-auto">
            Reabrir
          </Button>
        )}
      </div>
    </Card>
  );
}
