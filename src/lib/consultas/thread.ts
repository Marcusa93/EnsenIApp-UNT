"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Réplicas de una consulta: el ida y vuelta entre el estudiante y su docente.
 *
 * La misma acción sirve para los dos lados —quién puede escribir en qué hilo lo
 * decide la policy de question_messages (dueño de la consulta, docente de esa
 * comisión o admin), no este código—. El rol se congela en la fila para que el
 * hilo se siga leyendo igual si esa persona cambia de rol más adelante.
 */

const replySchema = z.object({
  questionId: z.guid("Consulta inválida."),
  body: z
    .string()
    .trim()
    .min(2, "Escribí tu mensaje antes de enviarlo.")
    .max(4000, "El mensaje no puede superar los 4000 caracteres."),
});

export type ReplyResult = { ok: true } | { ok: false; error: string };

export async function replyToQuestion(input: unknown): Promise<ReplyResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensaje inválido." };

  const ctx = await getOptionalUser();
  if (!ctx) return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." };
  if (ctx.profile.status === "bloqueado") return { ok: false, error: "Tu cuenta está bloqueada." };

  const supabase = await createClient();
  const { error } = await supabase.from("question_messages").insert({
    question_id: parsed.data.questionId,
    author_id: ctx.user.id,
    author_role: ctx.profile.role,
    body: parsed.data.body,
  });

  if (error) {
    console.error("[consultas] replyToQuestion", { questionId: parsed.data.questionId, error });
    // 42501 = la policy rechazó la escritura: no es un hilo de quien escribe.
    if (error.code === "42501") return { ok: false, error: "No podés escribir en esta consulta." };
    return { ok: false, error: "No pudimos enviar tu mensaje." };
  }

  revalidatePath("/campus/estudiante/consultas");
  revalidatePath("/campus/docente/consultas");
  return { ok: true };
}
