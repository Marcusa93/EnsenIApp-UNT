"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTeacherOf, type TeacherGuard } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { errorMessage } from "@/lib/utils";

const PATH = "/campus/docente/consultas";

interface QuestionRow {
  id: string;
  course_id: string;
  status: "abierta" | "respondida_ia" | "respondida_docente" | "cerrada";
  ai_answer_md: string | null;
  teacher_answer_md: string | null;
}

/** Carga la consulta (RLS) y verifica que quien opera sea docente del curso. */
async function guardQuestion(questionId: string): Promise<{ question: QuestionRow; guard: TeacherGuard }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_questions")
    .select("id, course_id, status, ai_answer_md, teacher_answer_md")
    .eq("id", questionId)
    .maybeSingle();
  if (error) {
    console.error("[consultas] guardQuestion", { questionId, error });
    throw new Error("No se pudo cargar la consulta.");
  }
  if (!data) throw new Error("La consulta no existe o no tenés acceso.");
  const guard = await requireTeacherOf(data.course_id);
  return { question: data, guard };
}

const answerSchema = z.object({
  question_id: z.uuid(),
  answer_md: z
    .string()
    .trim()
    .min(1, "Escribí una respuesta antes de publicarla.")
    .max(8000, "La respuesta es demasiado larga (máximo 8000 caracteres)."),
});

/** Publica (o corrige) la respuesta del docente: status pasa a respondida_docente. */
export async function answerQuestion(input: z.input<typeof answerSchema>): Promise<ActionResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");

  try {
    const { guard } = await guardQuestion(parsed.data.question_id);
    const { error } = await guard.supabase
      .from("student_questions")
      .update({
        teacher_answer_md: parsed.data.answer_md,
        answered_by: guard.ctx.user.id,
        answered_at: new Date().toISOString(),
        status: "respondida_docente",
      })
      .eq("id", parsed.data.question_id);
    if (error) {
      console.error("[consultas] answerQuestion", { questionId: parsed.data.question_id, error });
      return fail("No se pudo guardar la respuesta.");
    }
    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const publicSchema = z.object({ question_id: z.uuid(), is_public: z.boolean() });

/** Marca la consulta como pública (visible para todo el curso) o vuelve a privada. */
export async function setQuestionPublic(input: z.input<typeof publicSchema>): Promise<ActionResult> {
  const parsed = publicSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");

  try {
    const { guard } = await guardQuestion(parsed.data.question_id);
    const { error } = await guard.supabase
      .from("student_questions")
      .update({ is_public: parsed.data.is_public })
      .eq("id", parsed.data.question_id);
    if (error) {
      console.error("[consultas] setQuestionPublic", { questionId: parsed.data.question_id, error });
      return fail("No se pudo cambiar la visibilidad de la consulta.");
    }
    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const closedSchema = z.object({ question_id: z.uuid(), closed: z.boolean() });

/** Cierra la consulta o la reabre (recupera el estado según qué respuestas tenga). */
export async function setQuestionClosed(input: z.input<typeof closedSchema>): Promise<ActionResult> {
  const parsed = closedSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");

  try {
    const { question, guard } = await guardQuestion(parsed.data.question_id);
    const status = parsed.data.closed
      ? "cerrada"
      : question.teacher_answer_md
        ? "respondida_docente"
        : question.ai_answer_md
          ? "respondida_ia"
          : "abierta";
    const { error } = await guard.supabase.from("student_questions").update({ status }).eq("id", parsed.data.question_id);
    if (error) {
      console.error("[consultas] setQuestionClosed", { questionId: parsed.data.question_id, error });
      return fail("No se pudo cambiar el estado de la consulta.");
    }
    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/* ------------------------------------------------------------------------- */
/* Encuestas                                                                  */
/* ------------------------------------------------------------------------- */

const createPollSchema = z
  .object({
    course_id: z.uuid(),
    class_id: z.uuid().nullable().optional(),
    question: z.string().trim().min(5, "La pregunta es muy corta.").max(500, "La pregunta es demasiado larga."),
    options: z.array(z.string().trim().min(1, "Hay opciones vacías.").max(200)).max(10, "Máximo 10 opciones."),
    allow_free_text: z.boolean(),
    open_now: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.options.length === 0 && !v.allow_free_text) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Agregá opciones o habilitá la respuesta libre." });
    }
    if (v.options.length === 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Una encuesta con opciones necesita al menos dos." });
    }
    const unique = new Set(v.options.map((o) => o.toLowerCase()));
    if (unique.size !== v.options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Hay opciones repetidas." });
    }
  });

export async function createPoll(input: z.input<typeof createPollSchema>): Promise<ActionResult<{ poll_id: string }>> {
  const parsed = createPollSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const v = parsed.data;

  try {
    const { supabase, ctx } = await requireTeacherOf(v.course_id);

    if (v.class_id) {
      const { data: cls, error: cErr } = await supabase
        .from("classes")
        .select("id")
        .eq("id", v.class_id)
        .eq("course_id", v.course_id)
        .maybeSingle();
      if (cErr || !cls) return fail("La clase elegida no pertenece a este curso.");
    }

    const { data, error } = await supabase
      .from("polls")
      .insert({
        course_id: v.course_id,
        class_id: v.class_id ?? null,
        created_by: ctx.user.id,
        question: v.question,
        options: v.options,
        allow_free_text: v.allow_free_text,
        status: v.open_now ? "open" : "draft",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[consultas] createPoll", { courseId: v.course_id, error });
      return fail("No se pudo crear la encuesta.");
    }
    revalidatePath(PATH);
    return succeed({ poll_id: data.id });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const pollStatusSchema = z.object({ poll_id: z.uuid(), status: z.enum(["open", "closed"]) });

/** Abre o cierra una encuesta. Al cerrar se registra closes_at. */
export async function setPollStatus(input: z.input<typeof pollStatusSchema>): Promise<ActionResult> {
  const parsed = pollStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { poll_id, status } = parsed.data;

  try {
    const supabase = await createClient();
    const { data: poll, error: pErr } = await supabase.from("polls").select("id, course_id").eq("id", poll_id).maybeSingle();
    if (pErr) {
      console.error("[consultas] setPollStatus load", { poll_id, error: pErr });
      return fail("No se pudo cargar la encuesta.");
    }
    if (!poll) return fail("La encuesta no existe o no tenés acceso.");

    const guard = await requireTeacherOf(poll.course_id);
    const { error } = await guard.supabase
      .from("polls")
      .update({ status, closes_at: status === "closed" ? new Date().toISOString() : null })
      .eq("id", poll_id);
    if (error) {
      console.error("[consultas] setPollStatus", { poll_id, status, error });
      return fail("No se pudo cambiar el estado de la encuesta.");
    }
    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const deletePollSchema = z.object({ poll_id: z.uuid() });

/** Elimina la encuesta y sus respuestas (cascade). */
export async function deletePoll(input: z.input<typeof deletePollSchema>): Promise<ActionResult> {
  const parsed = deletePollSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { poll_id } = parsed.data;

  try {
    const supabase = await createClient();
    const { data: poll, error: pErr } = await supabase.from("polls").select("id, course_id").eq("id", poll_id).maybeSingle();
    if (pErr) {
      console.error("[consultas] deletePoll load", { poll_id, error: pErr });
      return fail("No se pudo cargar la encuesta.");
    }
    if (!poll) return fail("La encuesta no existe o no tenés acceso.");

    const guard = await requireTeacherOf(poll.course_id);
    const { error } = await guard.supabase.from("polls").delete().eq("id", poll_id);
    if (error) {
      console.error("[consultas] deletePoll", { poll_id, error });
      return fail("No se pudo eliminar la encuesta.");
    }
    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}
