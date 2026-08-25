"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTeacherOf } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { errorMessage } from "@/lib/utils";

const idSchema = z.string().guid();

/** Marca una alerta como resuelta (sólo docente del curso o admin). */
export async function resolveAlert(alertId: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(alertId);
  if (!parsed.success) return fail("Alerta inválida.");

  try {
    const supabase = await createClient();
    const { data: alert, error } = await supabase
      .from("teacher_alerts")
      .select("id, course_id, resolved")
      .eq("id", parsed.data)
      .maybeSingle();
    if (error) throw error;
    if (!alert) return fail("La alerta no existe o no tenés acceso.");
    if (alert.resolved) return succeed(undefined);

    const { ctx } = await requireTeacherOf(alert.course_id);

    const { error: updErr } = await supabase
      .from("teacher_alerts")
      .update({ resolved: true, resolved_by: ctx.user.id })
      .eq("id", alert.id);
    if (updErr) throw updErr;

    revalidatePath("/campus/docente");
    return succeed(undefined);
  } catch (err) {
    console.error("[docente] resolveAlert", { alertId, err });
    return fail(errorMessage(err, "No se pudo resolver la alerta."));
  }
}
