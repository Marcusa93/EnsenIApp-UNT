"use server";

import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { uuidSchema } from "@/components/docente/class-schema";
import { errorMessage } from "@/lib/utils";

const escalateSchema = z.object({ conversationId: uuidSchema });

/**
 * Escala la conversación con Alberdi al equipo docente: crea una consulta
 * (student_questions) con la última pregunta del estudiante y, como contexto,
 * la última respuesta de Alberdi. Queda "abierta" en la bandeja del docente.
 */
export async function escalateToTeacher(
  input: z.input<typeof escalateSchema>,
): Promise<ActionResult<{ questionId: string }>> {
  const parsed = escalateSchema.safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");

  const ctx = await getOptionalUser();
  if (!ctx) return fail("Tu sesión expiró. Volvé a ingresar.");

  const supabase = await createClient();

  const { data: conv, error: convError } = await supabase
    .from("alberdi_conversations")
    .select("id, student_id, course_id, class_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (convError) {
    console.error("[alberdi] escalate conversation", convError);
    return fail("No pudimos leer la conversación.");
  }
  if (!conv || conv.student_id !== ctx.user.id) return fail("No encontramos esa conversación.");

  const { data: messages, error: msgError } = await supabase
    .from("alberdi_messages")
    .select("role, content")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(6);
  if (msgError) {
    console.error("[alberdi] escalate messages", msgError);
    return fail("No pudimos leer la conversación.");
  }

  const lastUser = (messages ?? []).find((m) => m.role === "user");
  if (!lastUser) return fail("Todavía no hay una pregunta para enviar.");
  const lastAssistant = (messages ?? []).find((m) => m.role === "assistant");

  const { data: created, error } = await supabase
    .from("student_questions")
    .insert({
      student_id: ctx.user.id,
      course_id: conv.course_id,
      class_id: conv.class_id,
      recording_id: null,
      question: lastUser.content.slice(0, 4000),
      ai_answer_md: lastAssistant
        ? `_Lo que respondió Alberdi (el estudiante pidió que lo vea el equipo docente):_\n\n${lastAssistant.content}`.slice(0, 8000)
        : null,
      status: "abierta",
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[alberdi] escalate insert", error);
    return fail(errorMessage(error, "No se pudo enviar la consulta al equipo docente."));
  }

  return succeed({ questionId: created.id });
}
