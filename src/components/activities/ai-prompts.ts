import { COURSE_CONTEXT } from "@/lib/ai/prompts/context";
import { fenceUntrusted, inlineUntrusted, UNTRUSTED_CONTENT_RULE } from "@/lib/ai/untrusted";
import type { Activity } from "@/lib/types/helpers";
import {
  ACTIVITY_TYPE_LABEL,
  parseEssayAnswers,
  parseQuizAnswers,
  parseQuizContent,
  parseReadingAnswers,
  parseTextContent,
  type EditableType,
  type Submission,
} from "./model";

/* Prompts del módulo (server-only por uso). */

const MAX_TRANSCRIPT_CHARS = 60_000;

export function suggestSystemPrompt(type: EditableType): string {
  const byType: Record<EditableType, string> = {
    lectura: `Tipo: LECTURA. Proponé un título, una consigna (instructions_md) que oriente la lectura con 3-5 preguntas guía para la reflexión, y un body_md: un texto de lectura de 600-1000 palabras en markdown que sintetice con rigor el contenido jurídico de la clase (con subtítulos). "questions" debe ser un array vacío.`,
    cuestionario: `Tipo: CUESTIONARIO. Proponé un título, una consigna breve (instructions_md) y EXACTAMENTE 8 preguntas de opción múltiple sobre el contenido de la clase. Cada pregunta: 4 opciones plausibles, una sola correcta (correct_index, base 0), y una explanation de 1-3 oraciones que justifique la respuesta citando lo visto en clase. Variá la dificultad (recordar, comprender, aplicar a un caso). Evitá opciones "todas las anteriores". No incluyas body_md.`,
    entrega: `Tipo: ENTREGA (producción escrita). Proponé un título y una consigna (instructions_md) con: objetivo, un caso o problema jurídico concreto vinculado a la clase, 3-4 puntos que el trabajo debe desarrollar, extensión sugerida y criterios de evaluación explícitos (rúbrica breve con 3-4 criterios). "questions" debe ser un array vacío. No incluyas body_md.`,
  };
  return `${COURSE_CONTEXT}

Tu tarea: diseñar una actividad de tipo "${ACTIVITY_TYPE_LABEL[type]}" para los estudiantes a partir del material de una clase grabada (resumen y/o transcripción). La actividad debe ser realizable de forma autónoma desde el celular y evaluar comprensión real del contenido jurídico.
${byType[type]}
Escribí todo en español rioplatense, con voseo cuando te dirijas al estudiante.`;
}

export function suggestUserPrompt(input: {
  classTopic: string;
  recordingTitle: string | null;
  summaryMd: string | null;
  keyPoints: string[];
  transcript: string | null;
}): string {
  const parts: string[] = [`CLASE: ${input.classTopic}${input.recordingTitle ? ` — ${input.recordingTitle}` : ""}`];
  if (input.summaryMd) parts.push(`RESUMEN DE LA CLASE:\n${input.summaryMd}`);
  if (input.keyPoints.length) parts.push(`PUNTOS CLAVE:\n${input.keyPoints.map((k) => `- ${k}`).join("\n")}`);
  if (input.transcript) {
    const t = input.transcript.length > MAX_TRANSCRIPT_CHARS ? `${input.transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n[...transcripción truncada]` : input.transcript;
    parts.push(`TRANSCRIPCIÓN:\n${t}`);
  }
  return parts.join("\n\n");
}

export const FEEDBACK_SYSTEM_PROMPT = `${COURSE_CONTEXT}

Tu tarea: sos asistente del docente para CORREGIR la entrega de un estudiante. Vas a recibir la consigna, el contenido de la actividad y las respuestas del estudiante. Redactá un feedback en markdown, dirigido al estudiante en segunda persona (voseo), de 150-300 palabras, con esta estructura:
1. Una apertura breve que reconozca lo logrado (concreto, sin halagos vacíos).
2. "**Fortalezas**": 2-3 viñetas con lo que está bien, citando la respuesta.
3. "**Para mejorar**": 2-4 viñetas con errores conceptuales o de argumentación, explicando la corrección y, si corresponde, la norma o concepto que faltó.
4. "**Sugerencia de puntaje**": un número sobre el puntaje máximo, justificado en una oración, aplicando la rúbrica implícita en la consigna (comprensión conceptual, precisión jurídica, argumentación, cumplimiento de la consigna).
Sé honesto y específico. Si la entrega está vacía o es insuficiente, decilo con claridad y sugerí cómo rehacerla. No inventes contenido que el estudiante no escribió. Respondé sólo con el feedback en markdown, sin preámbulos.

${UNTRUSTED_CONTENT_RULE}`;

export function feedbackUserPrompt(
  activity: Pick<Activity, "type" | "title" | "instructions_md" | "content" | "max_score">,
  submission: Pick<Submission, "answers" | "auto_score" | "time_spent_seconds">,
): string {
  const max = activity.max_score ?? 10;
  const parts: string[] = [
    `ACTIVIDAD (${ACTIVITY_TYPE_LABEL[activity.type]}): ${activity.title}`,
    `PUNTAJE MÁXIMO: ${max}`,
    `CONSIGNA:\n${activity.instructions_md?.trim() || "(sin consigna escrita)"}`,
  ];

  if (activity.type === "cuestionario") {
    const content = parseQuizContent(activity.content);
    const answers = parseQuizAnswers(submission.answers);
    const lines = content.questions.map((q, i) => {
      const chosen = answers.choices[q.id];
      return `${i + 1}. ${q.prompt}\n   Opciones: ${q.options.map((o, oi) => `[${oi}] ${o}`).join(" | ")}\n   Correcta: [${q.correct_index}] · Estudiante eligió: ${chosen === undefined ? "(sin responder)" : `[${chosen}] ${chosen === q.correct_index ? "✔" : "✘"}`}${q.explanation ? `\n   Explicación docente: ${q.explanation}` : ""}`;
    });
    parts.push(`PREGUNTAS Y RESPUESTAS:\n${lines.join("\n")}`);
    if (submission.auto_score != null) parts.push(`PUNTAJE AUTOMÁTICO: ${submission.auto_score} / ${max}`);
  } else if (activity.type === "lectura") {
    const text = parseTextContent(activity.content);
    const a = parseReadingAnswers(submission.answers);
    if (text.body_md) parts.push(`TEXTO DE LA LECTURA (recortado):\n${text.body_md.slice(0, 8000)}`);
    parts.push(`MARCÓ COMO LEÍDA: ${a.read ? "sí" : "no"}`);
    parts.push(`REFLEXIÓN DEL ESTUDIANTE:\n${a.reflection.trim() ? fenceUntrusted(a.reflection) : "(vacía)"}`);
  } else {
    const text = parseTextContent(activity.content);
    const a = parseEssayAnswers(submission.answers);
    if (text.body_md) parts.push(`MATERIAL DE APOYO (recortado):\n${text.body_md.slice(0, 6000)}`);
    parts.push(`TEXTO DE LA ENTREGA:\n${a.text.trim() ? fenceUntrusted(a.text) : "(vacío)"}`);
    if (a.file_name) parts.push(`ADJUNTO: ${inlineUntrusted(a.file_name)} (no se puede leer su contenido; evaluá sólo el texto).`);
  }
  parts.push(`TIEMPO DEDICADO: ${Math.round(submission.time_spent_seconds / 60)} minutos`);
  return parts.join("\n\n");
}
