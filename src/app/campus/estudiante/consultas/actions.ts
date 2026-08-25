"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const askSchema = z.object({
  courseId: z.guid("Curso inválido."),
  question: z
    .string()
    .trim()
    .min(12, "Contanos un poco más: al menos 12 caracteres.")
    .max(2000, "La consulta no puede superar los 2000 caracteres."),
  classId: z.guid().nullable(),
  recordingId: z.guid().nullable(),
  isAnonymous: z.boolean(),
  isPublic: z.boolean(),
});

export type AskQuestionInput = z.input<typeof askSchema>;

export type AskQuestionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof AskQuestionInput, string>> };

/** Inserta una consulta del estudiante (RLS: sólo en cursos donde está inscripto). */
export async function askQuestion(input: AskQuestionInput): Promise<AskQuestionResult> {
  const { user } = await requireRole("estudiante");
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof AskQuestionInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key as keyof AskQuestionInput] = issue.message;
    }
    return { ok: false, error: "Revisá los datos de la consulta.", fieldErrors };
  }
  const data = parsed.data;

  const supabase = await createClient();

  // La grabación (si se indica) debe pertenecer a la clase indicada y estar visible para el estudiante.
  let recordingId = data.recordingId;
  let classId = data.classId;
  if (recordingId) {
    const { data: rec, error: recErr } = await supabase
      .from("class_recordings")
      .select("id, class_id")
      .eq("id", recordingId)
      .maybeSingle();
    if (recErr) console.error("[consultas] validar grabación", recErr);
    if (!rec) recordingId = null;
    else if (!classId) classId = rec.class_id;
    else if (rec.class_id !== classId) recordingId = null;
  }

  // La clase (propia o heredada de la grabación) debe pertenecer al curso indicado.
  if (classId) {
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, course_id")
      .eq("id", classId)
      .maybeSingle();
    if (clsErr) console.error("[consultas] validar clase", clsErr);
    if (!cls || cls.course_id !== data.courseId) {
      classId = null;
      recordingId = null;
    }
  }

  const { data: inserted, error } = await supabase
    .from("student_questions")
    .insert({
      student_id: user.id,
      course_id: data.courseId,
      class_id: classId,
      recording_id: recordingId,
      question: data.question,
      is_anonymous: data.isAnonymous,
      is_public: data.isPublic,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[consultas] insert student_questions", { userId: user.id, error });
    return {
      ok: false,
      error:
        error?.code === "42501"
          ? "No estás inscripto en esta comisión todavía. Cuando el equipo docente valide tu cuenta vas a poder consultar."
          : "No pudimos registrar tu consulta. Probá de nuevo en unos segundos.",
    };
  }

  revalidatePath("/campus/estudiante/consultas");
  revalidatePath("/campus/estudiante");
  return { ok: true, id: inserted.id };
}
