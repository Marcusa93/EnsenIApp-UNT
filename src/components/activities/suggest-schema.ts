import { z } from "zod";
import { EDITABLE_TYPES } from "./model";

/* Contrato de POST /api/activities/suggest (isomórfico: lo usan la ruta y el formulario). */

export const suggestRequestSchema = z.object({
  recordingId: z.guid("Grabación inválida."),
  type: z.enum(EDITABLE_TYPES),
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

export const suggestedQuestionSchema = z
  .object({
    prompt: z.string().min(5),
    options: z.array(z.string().min(1)).min(3).max(5),
    correct_index: z.number().int().min(0).max(4),
    explanation: z.string().min(5),
  })
  .refine((q) => q.correct_index < q.options.length, {
    message: "correct_index fuera de rango para las opciones dadas.",
    path: ["correct_index"],
  });

export const suggestionSchema = z.object({
  title: z.string().min(3).max(160),
  instructions_md: z.string().min(20),
  /** Sólo para cuestionario: 8 preguntas. Para otros tipos, array vacío. */
  questions: z.array(suggestedQuestionSchema).max(12),
  /** Sólo para lectura: texto base sugerido (markdown). */
  body_md: z.string().optional(),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

export interface SuggestResponse {
  suggestion: Suggestion;
  model: string;
  source: { transcript: boolean; summary: boolean };
}
