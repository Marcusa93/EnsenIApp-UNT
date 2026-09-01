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

/**
 * Mensajes por tipo de alerta. Un texto fijo y cuidado por señal: el objetivo
 * es un empujón amable de la cátedra, no un reto — y que mandarlo cueste un
 * solo clic, porque si cuesta más, no se manda.
 */
const AVISO_POR_KIND: Record<string, { title: string; body: string }> = {
  inactividad: {
    title: "Te extrañamos en el campus",
    body: "Hace días que no entrás. La materia sigue: tenés el material de las clases, los juegos para repasar y a Alberdi para consultar.",
  },
  bajo_desempeno: {
    title: "Un empujón de la cátedra",
    body: "Vimos que las últimas prácticas costaron. Repasá la clase que tengas más floja desde Mi progreso — y cualquier duda, mandala por Consultas.",
  },
  dificultad_reiterada: {
    title: "¿Necesitás una mano con la materia?",
    body: "Marcaste varias clases como difíciles. Contanos qué es lo que más cuesta por Consultas, así lo retomamos en clase.",
  },
};

/**
 * Le manda un aviso (campana + push) al estudiante de una alerta. Cierra el
 * círculo del seguimiento: la alerta detecta, el docente actúa sin salir del
 * panel. La alerta NO se resuelve sola — avisar no es lo mismo que resolver.
 */
export async function notifyAlertStudent(alertId: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(alertId);
  if (!parsed.success) return fail("Alerta inválida.");

  try {
    const supabase = await createClient();
    const { data: alert, error } = await supabase
      .from("teacher_alerts")
      .select("id, course_id, student_id, kind")
      .eq("id", parsed.data)
      .maybeSingle();
    if (error) throw error;
    if (!alert) return fail("La alerta no existe o no tenés acceso.");
    if (!alert.student_id) return fail("Esta alerta no apunta a un estudiante puntual.");

    const { ctx } = await requireTeacherOf(alert.course_id);

    const aviso = AVISO_POR_KIND[alert.kind] ?? {
      title: "Mensaje de la cátedra",
      body: "Pasate por el campus: hay material y actividades esperándote.",
    };

    const { notifyUsers } = await import("@/lib/push/send");
    await notifyUsers([alert.student_id], {
      kind: "aviso",
      title: aviso.title,
      body: aviso.body,
      url: "/campus/estudiante",
      courseId: alert.course_id,
      createdBy: ctx.user.id,
    });

    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}
