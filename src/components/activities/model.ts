import { z } from "zod";
import type { Json } from "@/lib/types/database";
import type { Activity, Enums, QuizContent, QuizQuestion, Tables, TextContent } from "@/lib/types/helpers";
import type { BadgeTone } from "@/components/ui/badge";

/* ---------------------------------------------------------------------------
 * Tipos de dominio (isomórficos: se usan en server y client)
 * ------------------------------------------------------------------------- */

export type ActivityType = Enums<"activity_type">;
export type ActivityStatus = Enums<"activity_status">;
export type ActivityTarget = Enums<"activity_target">;
export type SubmissionStatus = Enums<"submission_status">;
export type Submission = Tables<"activity_submissions">;

/** Tipos que este módulo implementa de punta a punta. */
export const EDITABLE_TYPES = ["lectura", "cuestionario", "entrega"] as const;
export type EditableType = (typeof EDITABLE_TYPES)[number];

export function isEditableType(type: ActivityType): type is EditableType {
  return (EDITABLE_TYPES as readonly string[]).includes(type);
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/* ---------------------------------------------------------------------------
 * Etiquetas y tonos
 * ------------------------------------------------------------------------- */

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  lectura: "Lectura",
  cuestionario: "Cuestionario",
  placas: "Placas",
  entrega: "Entrega",
  debate: "Debate",
  encuesta: "Encuesta",
};

export const ACTIVITY_TYPE_DESCRIPTION: Record<EditableType, string> = {
  lectura: "Un texto o material para leer. El estudiante lo marca como leído y puede dejar una reflexión breve.",
  cuestionario: "Preguntas de opción múltiple con corrección automática y explicación por pregunta.",
  entrega: "Consigna de producción escrita. Texto libre largo y, si querés, un archivo adjunto.",
};

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  closed: "Cerrada",
};

export const ACTIVITY_STATUS_TONE: Record<ActivityStatus, BadgeTone> = {
  draft: "muted",
  published: "success",
  closed: "accent-3",
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  en_progreso: "En progreso",
  entregada: "Entregada",
  corregida: "Corregida",
  reabierta: "Reabierta",
};

export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, BadgeTone> = {
  en_progreso: "warning",
  entregada: "accent-2",
  corregida: "success",
  reabierta: "accent-3",
};

/** Para los tipos que viven en otros módulos: a dónde mandar a cada rol. */
export function moduleLinkForActivity(
  activity: Pick<Activity, "type" | "recording_id">,
  role: "docente" | "estudiante",
): { href: string; label: string } | null {
  switch (activity.type) {
    case "placas":
      return activity.recording_id && role === "estudiante"
        ? { href: `/campus/estudiante/placas/${activity.recording_id}`, label: "Abrir placas interactivas" }
        : role === "docente"
          ? { href: "/campus/docente/clases", label: "Ver en Clases" }
          : { href: "/campus/estudiante/clases", label: "Ver en Clases" };
    case "debate":
      return { href: "/campus/debates", label: "Ir a Debates" };
    case "encuesta":
      return role === "docente"
        ? { href: "/campus/docente/consultas", label: "Ver en Consultas" }
        : { href: "/campus/estudiante", label: "Responder desde Hoy" };
    default:
      return null;
  }
}

/* ---------------------------------------------------------------------------
 * Contenido (activities.content) — esquemas zod + parsers tolerantes
 * ------------------------------------------------------------------------- */

export const quizQuestionSchema = z
  .object({
    id: z.string().min(1).max(64),
    prompt: z.string().trim().min(3, "La pregunta necesita un enunciado.").max(1000, "Enunciado demasiado largo."),
    options: z
      .array(z.string().trim().min(1, "Las opciones no pueden estar vacías.").max(500))
      .min(2, "Cada pregunta necesita al menos 2 opciones.")
      .max(6, "Máximo 6 opciones por pregunta."),
    correct_index: z.number().int().min(0),
    explanation: z.string().trim().max(2000).optional(),
  })
  .refine((q) => q.correct_index < q.options.length, {
    message: "Marcá cuál es la opción correcta.",
    path: ["correct_index"],
  });

export const quizContentSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1, "Agregá al menos una pregunta.").max(50),
});

export const textContentSchema = z.object({
  body_md: z.string().max(50_000).optional(),
  material_ids: z.array(z.uuid()).max(50).optional(),
  allow_file_upload: z.boolean().optional(),
});

function asRecord(json: Json | unknown): Record<string, unknown> {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

export function parseQuizContent(json: Json | unknown): QuizContent {
  const r = quizContentSchema.safeParse(json);
  if (r.success) return r.data;
  // Tolerante: si hay preguntas parcialmente válidas, devolvemos lo que se pueda.
  const raw = asRecord(json);
  const list = Array.isArray(raw.questions) ? raw.questions : [];
  const questions: QuizQuestion[] = [];
  list.forEach((q, i) => {
    const rec = asRecord(q);
    const options = Array.isArray(rec.options) ? rec.options.filter((o): o is string => typeof o === "string") : [];
    if (typeof rec.prompt !== "string" || options.length < 2) return;
    questions.push({
      id: typeof rec.id === "string" && rec.id ? rec.id : `q${i + 1}`,
      prompt: rec.prompt,
      options,
      correct_index: typeof rec.correct_index === "number" ? rec.correct_index : 0,
      explanation: typeof rec.explanation === "string" ? rec.explanation : undefined,
    });
  });
  return { questions };
}

export function parseTextContent(json: Json | unknown): TextContent {
  const r = textContentSchema.safeParse(json);
  if (r.success) return r.data;
  const raw = asRecord(json);
  return {
    body_md: typeof raw.body_md === "string" ? raw.body_md : undefined,
    material_ids: Array.isArray(raw.material_ids)
      ? raw.material_ids.filter((m): m is string => typeof m === "string")
      : undefined,
    allow_file_upload: raw.allow_file_upload === true,
  };
}

/* ---------------------------------------------------------------------------
 * Respuestas (activity_submissions.answers) por tipo
 * ------------------------------------------------------------------------- */

export interface ReadingAnswers {
  read: boolean;
  reflection: string;
}

export interface QuizAnswers {
  /** question.id → índice de opción elegida */
  choices: Record<string, number>;
}

export interface EssayAnswers {
  text: string;
  file_path: string | null;
  file_name: string | null;
}

export const readingAnswersSchema = z.object({
  read: z.boolean(),
  reflection: z.string().max(5000),
});

export const quizAnswersSchema = z.object({
  choices: z.record(z.string(), z.number().int().min(0).max(10)),
});

export const essayAnswersSchema = z.object({
  text: z.string().max(60_000),
  file_path: z.string().max(500).nullable(),
  file_name: z.string().max(255).nullable(),
});

export function parseReadingAnswers(json: Json | unknown): ReadingAnswers {
  const r = readingAnswersSchema.safeParse(json);
  if (r.success) return r.data;
  const raw = asRecord(json);
  return { read: raw.read === true, reflection: typeof raw.reflection === "string" ? raw.reflection : "" };
}

export function parseQuizAnswers(json: Json | unknown): QuizAnswers {
  const r = quizAnswersSchema.safeParse(json);
  if (r.success) return r.data;
  const raw = asRecord(json);
  const choices: Record<string, number> = {};
  Object.entries(asRecord(raw.choices)).forEach(([k, v]) => {
    if (typeof v === "number" && Number.isInteger(v)) choices[k] = v;
  });
  return { choices };
}

export function parseEssayAnswers(json: Json | unknown): EssayAnswers {
  const r = essayAnswersSchema.safeParse(json);
  if (r.success) return r.data;
  const raw = asRecord(json);
  return {
    text: typeof raw.text === "string" ? raw.text : "",
    file_path: typeof raw.file_path === "string" ? raw.file_path : null,
    file_name: typeof raw.file_name === "string" ? raw.file_name : null,
  };
}

/** ¿Hay algo respondido? (para decidir si se puede entregar y para telemetría). */
export function hasAnyAnswer(type: ActivityType, answers: Json | unknown): boolean {
  switch (type) {
    case "lectura":
      return parseReadingAnswers(answers).read;
    case "cuestionario":
      return Object.keys(parseQuizAnswers(answers).choices).length > 0;
    case "entrega": {
      const a = parseEssayAnswers(answers);
      return a.text.trim().length > 0 || Boolean(a.file_path);
    }
    default:
      return false;
  }
}

/* ---------------------------------------------------------------------------
 * Puntaje automático del cuestionario
 * ------------------------------------------------------------------------- */

export interface QuizScore {
  correct: number;
  total: number;
  score: number;
}

export function computeQuizScore(content: QuizContent, answers: QuizAnswers, maxScore: number): QuizScore {
  const total = content.questions.length;
  const correct = content.questions.filter((q) => answers.choices[q.id] === q.correct_index).length;
  const score = total === 0 ? 0 : Math.round((correct / total) * maxScore * 100) / 100;
  return { correct, total, score };
}

/* ---------------------------------------------------------------------------
 * Estados derivados
 * ------------------------------------------------------------------------- */

export type DueState = "none" | "open" | "soon" | "overdue";

export function getDueState(dueAt: string | null | undefined, now: number = Date.now()): DueState {
  if (!dueAt) return "none";
  const t = new Date(dueAt).getTime();
  if (!Number.isFinite(t)) return "none";
  const diff = t - now;
  if (diff < 0) return "overdue";
  if (diff < 24 * 3600 * 1000) return "soon";
  return "open";
}

export function isSubmitted(status: SubmissionStatus | null | undefined): boolean {
  return status === "entregada" || status === "corregida";
}

/** El estudiante puede seguir escribiendo (no entregó, o se la reabrieron). */
export function canStudentEdit(
  activity: Pick<Activity, "status">,
  submission: Pick<Submission, "status"> | null,
): boolean {
  if (activity.status !== "published") return false;
  return !submission || submission.status === "en_progreso" || submission.status === "reabierta";
}

export function effectiveScore(s: Pick<Submission, "score" | "auto_score">): number | null {
  return s.score ?? s.auto_score ?? null;
}

/* ---------------------------------------------------------------------------
 * Input del editor (crear / actualizar) — compartido por el formulario y las actions
 * ------------------------------------------------------------------------- */

export const activityInputSchema = z
  .object({
    course_id: z.uuid("Elegí un curso."),
    class_id: z.uuid().nullable(),
    recording_id: z.uuid().nullable(),
    type: z.enum(EDITABLE_TYPES, { message: "Elegí un tipo de actividad." }),
    title: z.string().trim().min(3, "El título necesita al menos 3 caracteres.").max(200, "Título demasiado largo."),
    instructions_md: z.string().max(20_000, "Las instrucciones son demasiado largas."),
    content: z.unknown(),
    target: z.enum(["todos", "seleccionados"]),
    student_ids: z.array(z.uuid()).max(1000),
    due_at: z.iso.datetime({ offset: true }).nullable(),
    max_score: z.number().min(1, "El puntaje máximo debe ser al menos 1.").max(100, "El puntaje máximo no puede superar 100."),
  })
  .superRefine((v, ctx) => {
    const schema = v.type === "cuestionario" ? quizContentSchema : textContentSchema;
    const r = schema.safeParse(v.content);
    if (!r.success) {
      r.error.issues.forEach((i) =>
        ctx.addIssue({ code: "custom", message: i.message, path: ["content", ...i.path] }),
      );
    }
    if (v.target === "seleccionados" && v.student_ids.length === 0) {
      ctx.addIssue({ code: "custom", message: "Elegí al menos un estudiante.", path: ["student_ids"] });
    }
  });

export type ActivityInput = z.input<typeof activityInputSchema>;

/** Primer error legible de un ZodError (para mostrar en UI). */
export function firstIssue(error: z.ZodError): string {
  const i = error.issues[0];
  if (!i) return "Datos inválidos.";
  const path = i.path.length ? `${i.path.map(String).join(".")}: ` : "";
  return `${path}${i.message}`;
}

export function newQuestionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export function emptyQuestion(): QuizQuestion {
  return { id: newQuestionId(), prompt: "", options: ["", ""], correct_index: 0, explanation: "" };
}

/** Formato de puntaje "8,5 / 10" */
export function formatScore(score: number | null | undefined, max: number | null | undefined): string {
  if (score == null) return "—";
  const s = score.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return max != null ? `${s} / ${max.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : s;
}
