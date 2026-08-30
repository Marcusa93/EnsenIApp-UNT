"use server";

import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VERSION } from "./texto";

/**
 * Registro de la decisión sobre el consentimiento informado.
 *
 * Se guarda tanto el sí como el no: quien ya decidió no vuelve a ver el cartel.
 * Volver a preguntarle a alguien que dijo que no es una forma de presión, y
 * acá quien pregunta es además quien pone la nota.
 */

/** Si todavía no decidió sobre ESTA versión del texto, hay que preguntarle. */
export async function faltaDecidir(): Promise<boolean> {
  const ctx = await getOptionalUser();
  // Sólo se le pide a estudiantes: son los sujetos del estudio.
  if (!ctx || ctx.profile.role !== "estudiante") return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_consent")
    .select("version")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (error) {
    console.error("[consentimiento] leer decisión", error);
    // Ante la duda no se molesta: mejor no mostrar que mostrar de más.
    return false;
  }
  return data?.version !== VERSION;
}

const decidirSchema = z.object({ acepta: z.boolean() });

export async function decidirConsentimiento(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = decidirSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Respuesta inválida." };

  const ctx = await getOptionalUser();
  if (!ctx) return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." };

  const supabase = await createClient();
  const { error } = await supabase.from("research_consent").upsert(
    {
      user_id: ctx.user.id,
      version: VERSION,
      accepted: parsed.data.acepta,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[consentimiento] guardar decisión", error);
    return { ok: false, error: "No pudimos guardar tu respuesta. Probá de nuevo." };
  }
  return { ok: true };
}
