"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOf } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { errorMessage } from "@/lib/utils";

const PATH = "/campus/docente/juegos";

const toggleSchema = z.object({
  course_id: z.guid(),
  game: z.enum(["duelo", "momento", "glosario"]),
  enabled: z.boolean(),
});

/** Prende o apaga un juego para la comisión. Apagado, deja de aparecerle al estudiante. */
export async function setGameEnabled(input: z.input<typeof toggleSchema>): Promise<ActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { course_id, game, enabled } = parsed.data;

  try {
    const { supabase } = await requireTeacherOf(course_id);
    const { error } = await supabase
      .from("course_games")
      .upsert({ course_id, game, enabled, updated_at: new Date().toISOString() }, { onConflict: "course_id,game" });

    if (error) {
      console.error("[juegos] toggle", error);
      return fail("No se pudo cambiar el juego.");
    }

    revalidatePath(PATH);
    revalidatePath("/campus/estudiante/juegos");
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const deleteSchema = z.object({ course_id: z.guid(), class_id: z.guid() });

/**
 * Borra el banco de desafíos de una clase (para regenerarlo de cero).
 * Va por clase y no por grabación: una clase puede tener desafíos hechos desde
 * la grabación y desde el apunte, y el docente los piensa como uno solo.
 */
export async function deleteChallenges(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { course_id, class_id } = parsed.data;

  try {
    const { supabase } = await requireTeacherOf(course_id);
    const { error } = await supabase
      .from("game_challenges")
      .delete()
      .eq("course_id", course_id)
      .eq("class_id", class_id);
    if (error) {
      console.error("[juegos] borrar desafíos", error);
      return fail("No se pudieron borrar los desafíos.");
    }

    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}
