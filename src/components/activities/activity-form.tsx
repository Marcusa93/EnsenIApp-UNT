"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  FileEdit,
  ListChecks,
  Paperclip,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { cn, errorMessage } from "@/lib/utils";
import type { Activity, QuizQuestion } from "@/lib/types/helpers";
import { saveActivity } from "@/app/campus/docente/actividades/actions";
import {
  ACTIVITY_TYPE_DESCRIPTION,
  ACTIVITY_TYPE_LABEL,
  EDITABLE_TYPES,
  activityInputSchema,
  emptyQuestion,
  firstIssue,
  newQuestionId,
  parseQuizContent,
  parseTextContent,
  type ActivityInput,
  type EditableType,
} from "./model";
import type { ClassOption, EnrolledStudent, MaterialOption, RecordingContext } from "./queries";
import { suggestionSchema, type SuggestResponse } from "./suggest-schema";
import { QuizEditor } from "./quiz-editor";
import { StudentPicker } from "./student-picker";

export interface ActivityFormProps {
  mode: "create" | "edit";
  courseId: string;
  courseName: string;
  classes: ClassOption[];
  materials: MaterialOption[];
  students: EnrolledStudent[];
  recording?: RecordingContext | null;
  initial?: { activity: Activity; assigned: string[] } | null;
}

const TYPE_ICON: Record<EditableType, LucideIcon> = {
  lectura: BookOpen,
  cuestionario: ListChecks,
  entrega: FileEdit,
};

const STEPS = [
  { key: "tipo", label: "Tipo" },
  { key: "contenido", label: "Contenido" },
  { key: "destinatarios", label: "Destinatarios" },
  { key: "cierre", label: "Fecha y puntaje" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

/** ISO → valor para <input type="datetime-local"> (hora local del navegador). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface FormState {
  type: EditableType;
  title: string;
  instructions: string;
  classId: string;
  questions: QuizQuestion[];
  bodyMd: string;
  materialIds: string[];
  allowFileUpload: boolean;
  target: "todos" | "seleccionados";
  studentIds: string[];
  dueLocal: string;
  maxScore: string;
}

function initialState(props: ActivityFormProps): FormState {
  const a = props.initial?.activity;
  const type: EditableType =
    a && (EDITABLE_TYPES as readonly string[]).includes(a.type) ? (a.type as EditableType) : "lectura";
  const quiz = a && type === "cuestionario" ? parseQuizContent(a.content) : { questions: [emptyQuestion()] };
  const text = a && type !== "cuestionario" ? parseTextContent(a.content) : {};
  return {
    type,
    title: a?.title ?? "",
    instructions: a?.instructions_md ?? "",
    classId: a?.class_id ?? props.recording?.class_id ?? "",
    questions: quiz.questions.length > 0 ? quiz.questions : [emptyQuestion()],
    bodyMd: text.body_md ?? "",
    materialIds: text.material_ids ?? [],
    allowFileUpload: text.allow_file_upload ?? false,
    target: a?.target ?? "todos",
    studentIds: props.initial?.assigned ?? [],
    dueLocal: toLocalInput(a?.due_at),
    maxScore: String(a?.max_score ?? 10),
  };
}

export function ActivityForm(props: ActivityFormProps) {
  const { mode, courseId, classes, materials, students, recording, initial } = props;
  const router = useRouter();
  const [state, setState] = React.useState<FormState>(() => initialState(props));
  const [step, setStep] = React.useState<StepKey>(mode === "create" ? "tipo" : "contenido");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestNote, setSuggestNote] = React.useState<string | null>(null);

  const patch = (p: Partial<FormState>) => setState((s) => ({ ...s, ...p }));
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const isWizard = mode === "create";
  const classMaterials = materials.filter((m) => !state.classId || m.class_id === state.classId);

  const buildInput = (): ActivityInput => ({
    course_id: courseId,
    class_id: state.classId || null,
    recording_id: initial?.activity.recording_id ?? recording?.id ?? null,
    type: state.type,
    title: state.title,
    instructions_md: state.instructions,
    content:
      state.type === "cuestionario"
        ? { questions: state.questions.map((q) => ({ ...q, explanation: q.explanation?.trim() || undefined })) }
        : {
            body_md: state.bodyMd.trim() || undefined,
            material_ids: state.materialIds.length ? state.materialIds : undefined,
            allow_file_upload: state.type === "entrega" ? state.allowFileUpload : undefined,
          },
    target: state.target,
    student_ids: state.target === "seleccionados" ? state.studentIds : [],
    due_at: fromLocalInput(state.dueLocal),
    max_score: Number(state.maxScore),
  });

  /** Valida sólo lo que corresponde al paso actual (para avanzar en el wizard). */
  const validateStep = (key: StepKey): string | null => {
    const input = buildInput();
    const r = activityInputSchema.safeParse(input);
    if (r.success) return null;
    const relevant = r.error.issues.filter((i) => {
      const head = String(i.path[0] ?? "");
      if (key === "contenido") return ["title", "instructions_md", "content", "class_id"].includes(head);
      if (key === "destinatarios") return ["target", "student_ids"].includes(head);
      if (key === "cierre") return ["due_at", "max_score"].includes(head);
      return head === "type";
    });
    if (relevant.length === 0) return null;
    const i = relevant[0];
    return i.message;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.key);
  };

  const submit = (publish: boolean) => {
    const input = buildInput();
    const r = activityInputSchema.safeParse(input);
    if (!r.success) {
      setError(firstIssue(r.error));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveActivity(input, { activityId: initial?.activity.id, publish });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/campus/docente/actividades/${res.data.id}`);
      router.refresh();
    });
  };

  const suggest = async () => {
    if (!recording) return;
    setSuggesting(true);
    setSuggestNote(null);
    setError(null);
    try {
      const res = await fetch("/api/activities/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: recording.id, type: state.type }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : null;
        throw new Error(msg ?? `La sugerencia falló (HTTP ${res.status}).`);
      }
      const payload = json as SuggestResponse;
      const s = suggestionSchema.parse(payload.suggestion);
      patch({
        title: s.title,
        instructions: s.instructions_md,
        ...(state.type === "cuestionario" && s.questions.length > 0
          ? {
              questions: s.questions.map((q) => ({
                id: newQuestionId(),
                prompt: q.prompt,
                options: q.options,
                correct_index: q.correct_index,
                explanation: q.explanation,
              })),
            }
          : {}),
        ...(state.type === "lectura" && s.body_md ? { bodyMd: s.body_md } : {}),
      });
      setSuggestNote(
        `Sugerencia generada con ${payload.model} a partir de ${
          payload.source.transcript ? "la transcripción" : "el resumen"
        } de la clase. Revisala y editá lo que haga falta.`,
      );
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar la sugerencia."));
    } finally {
      setSuggesting(false);
    }
  };

  const sectionVisible = (key: StepKey) => !isWizard || step === key;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isWizard && step !== "cierre") goNext();
        else submit(false);
      }}
      className="flex flex-col gap-5"
      aria-busy={pending}
    >
      {isWizard && (
        <ol className="flex flex-wrap items-center gap-2" aria-label="Pasos">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => i < stepIndex && setStep(s.key)}
                  disabled={i > stepIndex}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 rounded-full border px-3 font-mono text-[11px] uppercase tracking-widest transition-colors",
                    active && "border-accent bg-accent/10 text-accent",
                    done && "border-success/40 text-success hover:bg-success/10",
                    !active && !done && "border-border text-muted",
                  )}
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-current/15 text-[10px]">
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" aria-hidden />}
              </li>
            );
          })}
        </ol>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isWizard ? step : "all"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-5"
        >
          {/* Paso 1: tipo */}
          {sectionVisible("tipo") && (
            <Card>
              <span className="eyebrow">Tipo de actividad</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de actividad">
                {EDITABLE_TYPES.map((t) => {
                  const Icon = TYPE_ICON[t];
                  const active = state.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={mode === "edit"}
                      onClick={() => patch({ type: t })}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed",
                        active
                          ? "border-accent bg-accent/10 shadow-[0_0_40px_-16px_var(--accent)]"
                          : "border-border bg-surface-2/40 hover:border-accent/50",
                      )}
                    >
                      <span className={cn("[&>svg]:size-5", active ? "text-accent" : "text-muted")}>
                        <Icon aria-hidden />
                      </span>
                      <span className="text-sm font-semibold">{ACTIVITY_TYPE_LABEL[t]}</span>
                      <span className="text-xs leading-relaxed text-muted">{ACTIVITY_TYPE_DESCRIPTION[t]}</span>
                    </button>
                  );
                })}
              </div>
              {mode === "edit" && (
                <p className="mt-3 text-xs text-muted">El tipo no se puede cambiar una vez creada la actividad.</p>
              )}
              <p className="mt-3 text-xs text-muted">
                Placas, debates y encuestas se crean desde sus propios módulos (Clases, Debates y Consultas).
              </p>
            </Card>
          )}

          {/* Paso 2: contenido */}
          {sectionVisible("contenido") && (
            <>
              <Card className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="eyebrow">Contenido</span>
                    <p className="mt-1 text-sm text-muted">
                      {ACTIVITY_TYPE_LABEL[state.type]} · {props.courseName}
                    </p>
                  </div>
                  {recording && (
                    <Button
                      type="button"
                      variant="secondary"
                      leftIcon={<Sparkles />}
                      loading={suggesting}
                      onClick={suggest}
                      className="border-accent-2/40 text-accent-2 hover:border-accent-2"
                    >
                      Sugerir con IA
                    </Button>
                  )}
                </div>
                {recording && (
                  <p className="-mt-2 text-xs text-muted">
                    Basada en la grabación «{recording.title?.trim() || recording.class_topic}».
                  </p>
                )}
                {suggestNote && (
                  <p className="rounded-xl border border-accent-2/30 bg-accent-2/10 px-3 py-2 text-xs text-accent-2" role="status">
                    {suggestNote}
                  </p>
                )}

                <Field label="Título" htmlFor="act-title" required>
                  <Input
                    id="act-title"
                    value={state.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="Ej.: Cuestionario sobre protección de datos personales"
                    maxLength={200}
                    required
                  />
                </Field>

                <Field
                  label="Consigna / instrucciones"
                  htmlFor="act-instructions"
                  hint="Markdown"
                  description="Qué tiene que hacer el estudiante, criterios de evaluación, extensión esperada."
                >
                  <Textarea
                    id="act-instructions"
                    rows={5}
                    value={state.instructions}
                    onChange={(e) => patch({ instructions: e.target.value })}
                    placeholder="Explicá la consigna con tus palabras…"
                  />
                </Field>

                <Field label="Clase relacionada" htmlFor="act-class" description="Opcional. Sirve para vincular materiales y contexto.">
                  <Select
                    id="act-class"
                    value={state.classId}
                    onChange={(e) => patch({ classId: e.target.value, materialIds: [] })}
                    options={[
                      { value: "", label: "Sin clase asociada" },
                      ...classes.map((c) => ({ value: c.id, label: `${c.class_date} · ${c.topic}` })),
                    ]}
                  />
                </Field>
              </Card>

              {state.type === "cuestionario" ? (
                <Card>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="eyebrow">Preguntas ({state.questions.length})</span>
                    <Badge tone="accent-2" size="sm">
                      Corrección automática
                    </Badge>
                  </div>
                  <QuizEditor questions={state.questions} onChange={(questions) => patch({ questions })} disabled={pending} />
                </Card>
              ) : (
                <Card className="flex flex-col gap-4">
                  <span className="eyebrow">{state.type === "lectura" ? "Texto para leer" : "Material de apoyo"}</span>
                  <Field
                    label={state.type === "lectura" ? "Cuerpo de la lectura" : "Texto adicional"}
                    htmlFor="act-body"
                    hint="Markdown"
                    description={
                      state.type === "lectura"
                        ? "Podés pegar el texto completo o dejarlo vacío si sólo vinculás materiales."
                        : "Opcional: bibliografía, ejemplos o una rúbrica explícita."
                    }
                  >
                    <Textarea
                      id="act-body"
                      rows={8}
                      value={state.bodyMd}
                      onChange={(e) => patch({ bodyMd: e.target.value })}
                    />
                  </Field>

                  <div>
                    <span className="eyebrow text-foreground/80">Materiales vinculados</span>
                    {classMaterials.length === 0 ? (
                      <p className="mt-1.5 text-xs text-muted">
                        {state.classId
                          ? "Esta clase todavía no tiene materiales cargados."
                          : "Elegí una clase relacionada para vincular sus materiales."}
                      </p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {classMaterials.map((m) => {
                          const checked = state.materialIds.includes(m.id);
                          return (
                            <li key={m.id}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm hover:border-accent/50">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-[var(--accent)]"
                                  checked={checked}
                                  onChange={(e) =>
                                    patch({
                                      materialIds: e.target.checked
                                        ? [...state.materialIds, m.id]
                                        : state.materialIds.filter((id) => id !== m.id),
                                    })
                                  }
                                />
                                <Paperclip className="size-4 text-muted" aria-hidden />
                                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                                <Badge size="sm">{m.kind}</Badge>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {state.type === "entrega" && (
                    <Switch
                      checked={state.allowFileUpload}
                      onCheckedChange={(allowFileUpload) => patch({ allowFileUpload })}
                      label="Permitir adjuntar un archivo"
                      description="PDF, Word o imagen de hasta 10 MB, además del texto."
                    />
                  )}
                </Card>
              )}
            </>
          )}

          {/* Paso 3: destinatarios */}
          {sectionVisible("destinatarios") && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-accent" aria-hidden />
                <span className="eyebrow">Destinatarios</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Destinatarios">
                {(
                  [
                    { v: "todos", t: "Todo el curso", d: `Los ${students.length} inscriptos activos (y quienes se inscriban después).` },
                    { v: "seleccionados", t: "Estudiantes seleccionados", d: "Elegí a quiénes asignarla." },
                  ] as const
                ).map((o) => {
                  const active = state.target === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => patch({ target: o.v })}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        active ? "border-accent bg-accent/10" : "border-border bg-surface-2/40 hover:border-accent/50",
                      )}
                    >
                      <span className="block text-sm font-semibold">{o.t}</span>
                      <span className="mt-1 block text-xs text-muted">{o.d}</span>
                    </button>
                  );
                })}
              </div>
              {state.target === "seleccionados" && (
                <StudentPicker
                  students={students}
                  selected={state.studentIds}
                  onChange={(studentIds) => patch({ studentIds })}
                  disabled={pending}
                />
              )}
            </Card>
          )}

          {/* Paso 4: fecha límite y puntaje */}
          {sectionVisible("cierre") && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-accent" aria-hidden />
                <span className="eyebrow">Fecha límite y puntaje</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fecha límite"
                  htmlFor="act-due"
                  description="Opcional. Después de esta fecha el estudiante ve la actividad como vencida, pero puede entregar hasta que la cierres."
                >
                  <Input
                    id="act-due"
                    type="datetime-local"
                    value={state.dueLocal}
                    onChange={(e) => patch({ dueLocal: e.target.value })}
                  />
                </Field>
                <Field label="Puntaje máximo" htmlFor="act-max" description="Entre 1 y 100. El cuestionario se escala automáticamente.">
                  <Input
                    id="act-max"
                    type="number"
                    min={1}
                    max={100}
                    step="0.5"
                    value={state.maxScore}
                    onChange={(e) => patch({ maxScore: e.target.value })}
                    className="font-mono"
                  />
                </Field>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div>
          {isWizard && stepIndex > 0 && (
            <Button type="button" variant="ghost" leftIcon={<ArrowLeft />} onClick={() => setStep(STEPS[stepIndex - 1].key)} disabled={pending}>
              Atrás
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isWizard && step !== "cierre" ? (
            <Button type="submit" rightIcon={<ArrowRight />} disabled={pending}>
              Continuar
            </Button>
          ) : (
            <>
              <Button type="submit" variant="secondary" leftIcon={<Save />} loading={pending}>
                {mode === "create" ? "Guardar borrador" : "Guardar cambios"}
              </Button>
              {(mode === "create" || initial?.activity.status !== "published") && (
                <Button type="button" leftIcon={<Send />} loading={pending} onClick={() => submit(true)}>
                  {mode === "create" ? "Publicar ahora" : "Guardar y publicar"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </form>
  );
}
