"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOfClass } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { uuidSchema, fieldErrors } from "@/components/docente/class-schema";
import { generateLiveCode } from "@/lib/live/code";
import { errorMessage } from "@/lib/utils";

const promptSchema = z.object({
  classId: uuidSchema,
  question: z.string().trim().min(6, "La pregunta necesita al menos 6 caracteres.").max(240, "Máximo 240 caracteres."),
});

function revalidateLive(classId: string) {
  revalidatePath(`/campus/docente/clases/${classId}/vivo`);
}

export async function createPrompt(input: z.input<typeof promptSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá la pregunta.", fieldErrors(parsed.error));
  try {
    const { supabase, ctx } = await requireTeacherOfClass(parsed.data.classId);
    const { data: existing } = await supabase
      .from("live_prompts")
      .select("display_order")
      .eq("class_id", parsed.data.classId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (existing?.display_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("live_prompts")
      .insert({
        class_id: parsed.data.classId,
        question: parsed.data.question,
        display_order: nextOrder,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateLive(parsed.data.classId);
    return succeed({ id: data.id });
  } catch (err) {
    console.error("[docente/vivo] createPrompt", { err });
    return fail(errorMessage(err, "No se pudo crear la pregunta."));
  }
}

const updatePromptSchema = z.object({
  classId: uuidSchema,
  id: uuidSchema,
  question: z.string().trim().min(6, "La pregunta necesita al menos 6 caracteres.").max(240, "Máximo 240 caracteres."),
});

export async function updatePrompt(input: z.input<typeof updatePromptSchema>): Promise<ActionResult> {
  const parsed = updatePromptSchema.safeParse(input);
  if (!parsed.success) return fail("Revisá la pregunta.", fieldErrors(parsed.error));
  try {
    const { supabase } = await requireTeacherOfClass(parsed.data.classId);
    const { error } = await supabase
      .from("live_prompts")
      .update({ question: parsed.data.question })
      .eq("id", parsed.data.id)
      .eq("class_id", parsed.data.classId);
    if (error) throw error;
    revalidateLive(parsed.data.classId);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/vivo] updatePrompt", { err });
    return fail(errorMessage(err, "No se pudo guardar la pregunta."));
  }
}

const idInClassSchema = z.object({ classId: uuidSchema, id: uuidSchema });

export async function deletePrompt(input: z.input<typeof idInClassSchema>): Promise<ActionResult> {
  const parsed = idInClassSchema.safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");
  try {
    const { supabase } = await requireTeacherOfClass(parsed.data.classId);
    const { error } = await supabase.from("live_prompts").delete().eq("id", parsed.data.id).eq("class_id", parsed.data.classId);
    if (error) throw error;
    revalidateLive(parsed.data.classId);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/vivo] deletePrompt", { err });
    return fail(errorMessage(err, "No se pudo borrar la pregunta."));
  }
}

const reorderSchema = z.object({ classId: uuidSchema, orderedIds: z.array(uuidSchema).min(1) });

export async function reorderPrompts(input: z.input<typeof reorderSchema>): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");
  try {
    const { supabase } = await requireTeacherOfClass(parsed.data.classId);
    await Promise.all(
      parsed.data.orderedIds.map((id, i) =>
        supabase.from("live_prompts").update({ display_order: i + 1 }).eq("id", id).eq("class_id", parsed.data.classId),
      ),
    );
    revalidateLive(parsed.data.classId);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/vivo] reorderPrompts", { err });
    return fail(errorMessage(err, "No se pudo reordenar."));
  }
}

export async function createLiveSession(input: {
  classId: string;
}): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = z.object({ classId: uuidSchema }).safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");
  try {
    const { supabase, ctx } = await requireTeacherOfClass(parsed.data.classId);
    const { data: cls, error: clsError } = await supabase
      .from("classes")
      .select("topic")
      .eq("id", parsed.data.classId)
      .single();
    if (clsError) throw clsError;

    // El código es único; reintentamos unas pocas veces ante una colisión rarísima.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from("live_sessions")
        .insert({
          class_id: parsed.data.classId,
          code: generateLiveCode(),
          class_topic: cls.topic,
          created_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (!error) {
        revalidateLive(parsed.data.classId);
        return succeed({ sessionId: data.id });
      }
      lastError = error;
      if ((error as { code?: string }).code !== "23505") break;
    }
    throw lastError ?? new Error("No se pudo generar un código único.");
  } catch (err) {
    console.error("[docente/vivo] createLiveSession", { err });
    return fail(errorMessage(err, "No se pudo crear la sesión en vivo."));
  }
}
