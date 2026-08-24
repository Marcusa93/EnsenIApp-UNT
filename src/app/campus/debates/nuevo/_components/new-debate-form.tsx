"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Swords, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STANCE_META } from "@/components/debates/stance";
import { StanceIcon } from "@/components/debates/stance-badge";
import { createDebate, proposeDebate, type DebateProposal } from "../actions";

export interface CourseOption {
  id: string;
  name: string;
  term: string;
}
export interface ClassOption {
  id: string;
  course_id: string;
  topic: string;
  class_date: string;
}
export interface RecordingOption {
  id: string;
  class_id: string;
  title: string | null;
  ready: boolean;
}

export interface NewDebateFormProps {
  courses: CourseOption[];
  classes: ClassOption[];
  recordings: RecordingOption[];
  initialClassId: string | null;
  initialRecordingId: string | null;
}

const CONTEXT_MAX = 12000;

/** datetime-local (hora local del navegador) → ISO con offset. */
function localToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function defaultCloseLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewDebateForm({ courses, classes, recordings, initialClassId, initialRecordingId }: NewDebateFormProps) {
  // Resolver curso/clase iniciales a partir de los query params
  const initialRecording = initialRecordingId ? recordings.find((r) => r.id === initialRecordingId) ?? null : null;
  const resolvedClassId = initialRecording?.class_id ?? initialClassId;
  const initialClass = resolvedClassId ? classes.find((c) => c.id === resolvedClassId) ?? null : null;

  const [courseId, setCourseId] = React.useState(initialClass?.course_id ?? courses[0]?.id ?? "");
  const [classId, setClassId] = React.useState(initialClass?.id ?? "");
  const [recordingId, setRecordingId] = React.useState(initialRecording?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [context, setContext] = React.useState("");
  const [closesAt, setClosesAt] = React.useState(defaultCloseLocal);
  const [preview, setPreview] = React.useState(false);
  const [proposal, setProposal] = React.useState<DebateProposal | null>(null);
  const [proposing, setProposing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ title?: string; closesAt?: string }>({});

  const classOptions = React.useMemo(() => classes.filter((c) => c.course_id === courseId), [classes, courseId]);
  const recordingOptions = React.useMemo(
    () => recordings.filter((r) => (classId ? r.class_id === classId : classOptions.some((c) => c.id === r.class_id))),
    [recordings, classId, classOptions],
  );
  const selectedRecording = recordings.find((r) => r.id === recordingId) ?? null;

  const onCourseChange = (id: string) => {
    setCourseId(id);
    setClassId("");
    setRecordingId("");
  };
  const onClassChange = (id: string) => {
    setClassId(id);
    if (recordingId && !recordings.some((r) => r.id === recordingId && r.class_id === id)) setRecordingId("");
  };
  const onRecordingChange = (id: string) => {
    setRecordingId(id);
    const rec = recordings.find((r) => r.id === id);
    if (rec && rec.class_id !== classId) setClassId(rec.class_id);
  };

  const propose = async () => {
    if (!recordingId) return;
    setProposing(true);
    setError(null);
    const res = await proposeDebate({ recordingId });
    setProposing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProposal(res.data);
    setTitle(res.data.title);
    setContext(
      `${res.data.context_md.trim()}\n\n### Posturas iniciales sugeridas\n\n- **A favor:** ${res.data.stances.a_favor}\n- **En contra:** ${res.data.stances.en_contra}`,
    );
  };

  const validate = () => {
    const errs: { title?: string; closesAt?: string } = {};
    if (title.trim().length < 5) errs.title = "El título debe tener al menos 5 caracteres.";
    const iso = localToIso(closesAt);
    if (closesAt && !iso) errs.closesAt = "Fecha inválida.";
    if (iso && new Date(iso).getTime() <= Date.now()) errs.closesAt = "La fecha de cierre tiene que ser futura.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    const res = await createDebate({
      courseId,
      classId: classId || null,
      recordingId: recordingId || null,
      title: title.trim(),
      contextMd: context.trim() || undefined,
      closesAt: localToIso(closesAt),
    });
    // Si la acción redirige, nunca llega acá.
    setSubmitting(false);
    if (res && !res.ok) setError(res.error);
  };

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" noValidate>
      <div className="flex flex-col gap-5">
        <Card padding="lg" className="flex flex-col gap-5">
          <h2 className="eyebrow">Planteo</h2>

          <Field label="Título" htmlFor="title" required error={fieldErrors.title} hint="Pregunta o tesis polémica">
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Debe el Estado regular los sistemas de IA generativa como productos riesgosos?"
              maxLength={200}
              invalid={Boolean(fieldErrors.title)}
              required
            />
          </Field>

          <Field
            label="Contexto"
            htmlFor="context"
            hint={
              <span className="inline-flex items-center gap-3">
                <span className="tabular-nums">
                  {context.length.toLocaleString("es-AR")} / {CONTEXT_MAX.toLocaleString("es-AR")}
                </span>
                <button
                  type="button"
                  onClick={() => setPreview((v) => !v)}
                  className="font-mono text-[10px] uppercase tracking-widest text-accent-2 hover:underline"
                  aria-pressed={preview}
                >
                  {preview ? "Editar" : "Vista previa"}
                </button>
              </span>
            }
            description="Markdown. Presentá el problema, las normas o principios en tensión y qué conceptos de la clase deben usar para argumentar."
          >
            {preview ? (
              <div className="min-h-40 rounded-xl border border-border bg-surface-2/40 px-4 py-3">
                {context.trim() ? (
                  <Markdown size="sm">{context}</Markdown>
                ) : (
                  <p className="text-sm text-muted">Sin contexto todavía.</p>
                )}
              </div>
            ) : (
              <Textarea
                id="context"
                rows={12}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                maxLength={CONTEXT_MAX}
                placeholder="## El problema&#10;…&#10;&#10;## Qué está en juego&#10;…"
                className="font-mono text-[13px]"
              />
            )}
          </Field>
        </Card>

        <AnimatePresence>
          {proposal && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-label="Posturas sugeridas por la IA"
              className="grid gap-3 sm:grid-cols-2"
            >
              {(["a_favor", "en_contra"] as const).map((s) => (
                <div key={s} className={cn("rounded-2xl border p-4", STANCE_META[s].border, STANCE_META[s].bg)}>
                  <div className={cn("mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest", STANCE_META[s].text)}>
                    <StanceIcon stance={s} className="size-3" />
                    {STANCE_META[s].label} · sugerida
                  </div>
                  <p className="text-sm leading-relaxed">{proposal.stances[s]}</p>
                </div>
              ))}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <aside className="flex flex-col gap-5">
        <Card padding="md" className="flex flex-col gap-4">
          <h2 className="eyebrow">Vínculo con la cursada</h2>

          <Field label="Curso" htmlFor="course" required>
            <Select
              id="course"
              value={courseId}
              onChange={(e) => onCourseChange(e.target.value)}
              options={courses.map((c) => ({ value: c.id, label: `${c.name} · ${c.term}` }))}
            />
          </Field>

          <Field label="Clase" htmlFor="class" hint="Opcional">
            <Select
              id="class"
              value={classId}
              onChange={(e) => onClassChange(e.target.value)}
              placeholder="Sin clase asociada"
              options={classOptions.map((c) => ({ value: c.id, label: `${formatDate(c.class_date)} · ${c.topic}` }))}
              disabled={classOptions.length === 0}
            />
          </Field>

          <Field
            label="Grabación"
            htmlFor="recording"
            hint="Opcional"
            description={
              recordingOptions.length === 0
                ? "No hay grabaciones para la selección actual."
                : "Habilita «Proponer con IA» a partir del resumen y la transcripción."
            }
          >
            <Select
              id="recording"
              value={recordingId}
              onChange={(e) => onRecordingChange(e.target.value)}
              placeholder="Sin grabación"
              options={recordingOptions.map((r) => {
                const cls = classes.find((c) => c.id === r.class_id);
                return {
                  value: r.id,
                  label: `${r.title ?? cls?.topic ?? "Grabación"}${r.ready ? "" : " (procesando)"}`,
                  disabled: !r.ready,
                };
              })}
              disabled={recordingOptions.length === 0}
            />
          </Field>

          <Button
            type="button"
            variant="secondary"
            leftIcon={<Wand2 />}
            onClick={() => void propose()}
            loading={proposing}
            disabled={!recordingId || !selectedRecording?.ready || submitting}
            className="w-full"
          >
            {proposal ? "Volver a proponer con IA" : "Proponer con IA"}
          </Button>
          {proposing && (
            <p className="inline-flex items-center gap-2 text-xs text-muted" role="status">
              <Sparkles className="size-3.5 animate-pulse text-accent" aria-hidden />
              Leyendo la clase y buscando una controversia…
            </p>
          )}
        </Card>

        <Card padding="md" className="flex flex-col gap-4">
          <h2 className="eyebrow">Cierre</h2>
          <Field
            label="Fecha y hora de cierre"
            htmlFor="closes"
            hint="Opcional"
            error={fieldErrors.closesAt}
            description="Después de esa hora no se aceptan argumentos. Podés cerrar antes a mano."
          >
            <Input
              id="closes"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              invalid={Boolean(fieldErrors.closesAt)}
            />
          </Field>
        </Card>

        {error && (
          <p className="flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <Button type="submit" size="lg" leftIcon={<Swords />} loading={submitting} disabled={proposing} className="glow w-full">
          Abrir debate
        </Button>
      </aside>
    </form>
  );
}
