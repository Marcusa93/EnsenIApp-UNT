"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/utils";
import { BUILDS, CHASSIS, GLOWS, TONES } from "@/components/avatar/palette";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const SLOTS = ["visor", "toga", "instrumento", "companion", "aura", "fondo"] as const;

const baseSchema = z.object({
  callsign: z
    .string()
    .trim()
    .min(3, "Poné al menos 3 caracteres.")
    .max(20, "Máximo 20 caracteres.")
    // Alias, no nombre real: letras, números, espacio y guiones.
    .regex(/^[\p{L}\p{N} .'-]+$/u, "Usá sólo letras, números y espacios."),
  chassis: z.enum(CHASSIS.map((c) => c.id) as [string, ...string[]]),
  tone: z.enum(TONES.map((t) => t.id) as [string, ...string[]]),
  glow: z.enum(GLOWS.map((g) => g.id) as [string, ...string[]]),
  build: z.enum(BUILDS.map((b) => b.id) as [string, ...string[]]).default("estandar"),
});

/**
 * Crea el operador la primera vez. Al crearlo se corre el desbloqueo, así arranca
 * con el equipo de inicio puesto en vez de aparecer desnudo.
 */
export async function createOperator(input: z.input<typeof baseSchema>): Promise<ActionResult> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const { user } = await requireRole("estudiante");
    const supabase = await createClient();

    const { error } = await supabase.from("student_avatars").upsert(
      {
        student_id: user.id,
        callsign: parsed.data.callsign,
        chassis: parsed.data.chassis,
        tone: parsed.data.tone,
        glow: parsed.data.glow,
        build: parsed.data.build,
        // Equipo de arranque: lo que todo operador tiene desde el día uno.
        equipped: {
          visor: "visor-basico",
          toga: "toga-cursante",
          instrumento: "inst-codice",
          fondo: "fondo-aula",
        },
      },
      { onConflict: "student_id" },
    );

    if (error) {
      console.error("[avatar] crear", error);
      return { ok: false, error: "No pudimos crear tu operador." };
    }

    // El desbloqueo es SECURITY DEFINER y evalúa todo el catálogo de una.
    const admin = createAdminClient();
    const { error: rpcError } = await admin.rpc("unlock_avatar_items", { p_student: user.id });
    if (rpcError) console.error("[avatar] desbloqueo inicial", rpcError);

    revalidatePath("/campus/estudiante/juegos");
    revalidatePath("/campus/cuenta");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Cambia el aspecto base (alias, chasis, tono, luz) sin tocar lo equipado. */
export async function updateOperator(input: z.input<typeof baseSchema>): Promise<ActionResult> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const { user } = await requireRole("estudiante");
    const supabase = await createClient();
    const { error } = await supabase
      .from("student_avatars")
      .update({
        callsign: parsed.data.callsign,
        chassis: parsed.data.chassis,
        tone: parsed.data.tone,
        glow: parsed.data.glow,
        build: parsed.data.build,
      })
      .eq("student_id", user.id);

    if (error) {
      console.error("[avatar] actualizar", error);
      return { ok: false, error: "No pudimos guardar los cambios." };
    }

    revalidatePath("/campus/estudiante/juegos");
    revalidatePath("/campus/cuenta");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const equipSchema = z.object({
  slot: z.enum(SLOTS),
  /** null saca lo que tenía puesto (para aura y compañero, que son opcionales). */
  itemId: z.string().min(1).max(60).nullable(),
});

/** Equipa un ítem, verificando que el estudiante realmente lo tenga desbloqueado. */
export async function equipItem(input: z.input<typeof equipSchema>): Promise<ActionResult> {
  const parsed = equipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { slot, itemId } = parsed.data;

  try {
    const { user } = await requireRole("estudiante");
    const supabase = await createClient();

    const { data: avatar } = await supabase
      .from("student_avatars")
      .select("equipped")
      .eq("student_id", user.id)
      .maybeSingle();
    if (!avatar) return { ok: false, error: "Todavía no creaste tu operador." };

    if (itemId) {
      // Que el ítem exista, sea de este slot y esté desbloqueado.
      const { data: item } = await supabase
        .from("avatar_items")
        .select("id, slot")
        .eq("id", itemId)
        .maybeSingle();
      if (!item || item.slot !== slot) return { ok: false, error: "Ese equipo no va en esa ranura." };

      const { data: owned } = await supabase
        .from("student_avatar_items")
        .select("item_id")
        .eq("student_id", user.id)
        .eq("item_id", itemId)
        .maybeSingle();
      if (!owned) return { ok: false, error: "Todavía no desbloqueaste ese equipo." };
    }

    const equipped = { ...((avatar.equipped as Record<string, string>) ?? {}) };
    if (itemId) equipped[slot] = itemId;
    else delete equipped[slot];

    const { error } = await supabase
      .from("student_avatars")
      .update({ equipped })
      .eq("student_id", user.id);

    if (error) {
      console.error("[avatar] equipar", error);
      return { ok: false, error: "No pudimos equipar eso." };
    }

    revalidatePath("/campus/estudiante/juegos");
    revalidatePath("/campus/cuenta");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Marca como vistos los ítems recién desbloqueados (para no repetir la celebración). */
export async function markItemsSeen(): Promise<ActionResult> {
  try {
    const { user } = await requireRole("estudiante");
    const supabase = await createClient();
    const { error } = await supabase
      .from("student_avatar_items")
      .update({ seen: true })
      .eq("student_id", user.id)
      .eq("seen", false);
    if (error) console.error("[avatar] marcar vistos", error);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
