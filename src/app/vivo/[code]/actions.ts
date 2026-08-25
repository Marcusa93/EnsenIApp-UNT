"use server";

import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeWord } from "@/lib/live/normalize";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { uuidSchema } from "@/components/docente/class-schema";
import { errorMessage } from "@/lib/utils";

const schema = z.object({
  sessionId: uuidSchema,
  promptId: uuidSchema,
  word: z.string().trim().min(1, "Escribí algo.").max(60, "Máximo 60 caracteres."),
});

/** Envía una respuesta a la disparadora activa. La RLS exige que sea justo la que está activa ahora mismo. */
export async function submitWord(input: z.input<typeof schema>): Promise<ActionResult<{ word: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisá tu respuesta.");

  const ctx = await getOptionalUser();
  if (!ctx) return fail("Tu sesión expiró. Volvé a entrar con el link.");

  const normalized = normalizeWord(parsed.data.word);
  if (!normalized) return fail("Escribí algo con letras o números.");

  const supabase = await createClient();
  const { error } = await supabase.from("live_responses").insert({
    session_id: parsed.data.sessionId,
    prompt_id: parsed.data.promptId,
    participant_id: ctx.user.id,
    word: parsed.data.word.trim().slice(0, 60),
    normalized_word: normalized,
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return succeed({ word: parsed.data.word.trim() });
    }
    console.error("[vivo] submitWord", { error });
    return fail(errorMessage(error, "No se pudo enviar. ¿La pregunta sigue activa?"));
  }
  return succeed({ word: parsed.data.word.trim() });
}
