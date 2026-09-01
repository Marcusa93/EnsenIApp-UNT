"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOf } from "@/components/docente/teacher-guard";
import { fail, type ActionResult } from "@/components/docente/types";
import { errorMessage } from "@/lib/utils";

const schema = z.object({ course_id: z.guid(), student_id: z.guid() });

/** Crea un report_requests scope='estudiante' y redirige al informe (que se genera solo). */
export async function createStudentReport(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { course_id, student_id } = parsed.data;

  let reportId: string;
  try {
    const { supabase, ctx } = await requireTeacherOf(course_id);
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", course_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (!enrollment) return fail("El estudiante no está inscripto en este curso.");

    const { data, error } = await supabase
      .from("report_requests")
      .insert({
        requested_by: ctx.user.id,
        course_id,
        scope: "estudiante",
        filters: { student_id },
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[estudiante] createStudentReport", { course_id, student_id, error });
      return fail("No se pudo crear el pedido de informe.");
    }
    reportId = data.id;
  } catch (err) {
    return fail(errorMessage(err));
  }

  revalidatePath("/campus/docente/informes");
  redirect(`/campus/docente/informes/${reportId}?run=1`);
}

const messageSchema = z.object({
  course_id: z.guid(),
  student_id: z.guid(),
  body: z
    .string()
    .trim()
    .min(3, "Escribí el mensaje antes de enviarlo.")
    .max(500, "Máximo 500 caracteres: es un aviso, no una carta documento."),
});

/**
 * Mensaje directo del docente al estudiante, desde su ficha. Llega a la
 * campana (y al push si lo tiene prendido) firmado por quien lo manda. Hasta
 * acá el docente sólo podía REACCIONAR (responder consultas, avisar desde una
 * alerta); esto le deja iniciar el contacto: "te reabrí la entrega", "pasate
 * por consultas", "buen trabajo con la última actividad".
 */
export async function sendStudentMessage(input: z.input<typeof messageSchema>): Promise<ActionResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");

  try {
    const { ctx, supabase } = await requireTeacherOf(parsed.data.course_id);

    // Que sea alguien de la comisión de este docente, no cualquier uuid.
    const { data: enrolled } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", parsed.data.course_id)
      .eq("student_id", parsed.data.student_id)
      .maybeSingle();
    if (!enrolled) return fail("El estudiante no está inscripto en esta comisión.");

    const nombre = ctx.profile.full_name.split(" ")[0] || "la cátedra";
    const { notifyUsers } = await import("@/lib/push/send");
    await notifyUsers([parsed.data.student_id], {
      kind: "aviso",
      title: `Mensaje de ${nombre} (cátedra)`,
      body: parsed.data.body,
      url: "/campus/estudiante",
      courseId: parsed.data.course_id,
      createdBy: ctx.user.id,
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return fail(errorMessage(err, "No se pudo enviar el mensaje."));
  }
}

const resetSchema = z.object({ course_id: z.guid(), student_id: z.guid() });

/** Palabras fáciles de dictar en voz alta: sin tildes, sin ambigüedad. */
const PALABRAS = ["aula", "toga", "fallo", "libro", "clase", "norma", "juez", "pluma"];

/**
 * Repone la contraseña de un estudiante que no puede entrar.
 *
 * En un aula, el docente ES el canal de recuperación: el mail de "olvidé mi
 * contraseña" depende de que el envío funcione (hoy el proyecto usa el SMTP de
 * prueba de Supabase, tapado en 2 mails por hora y flojo para llegar a Gmail),
 * mientras que el docente tiene al estudiante enfrente o en el grupo.
 *
 * Devuelve la contraseña nueva UNA sola vez para dictarla, y deja la cuenta
 * marcada para que el estudiante tenga que elegir la suya al entrar: la que
 * dicta el docente nunca queda como definitiva.
 */
export async function resetStudentPassword(
  input: z.input<typeof resetSchema>,
): Promise<ActionResult<{ password: string }>> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");

  try {
    const { supabase } = await requireTeacherOf(parsed.data.course_id);

    const { data: enrolled } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", parsed.data.course_id)
      .eq("student_id", parsed.data.student_id)
      .maybeSingle();
    if (!enrolled) return fail("El estudiante no está inscripto en esta comisión.");

    // No se le repone la contraseña a un docente o admin desde acá.
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", parsed.data.student_id)
      .maybeSingle();
    if (perfil?.role !== "estudiante") return fail("Sólo se repone la contraseña de estudiantes.");

    const palabra = PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
    const numero = String(Math.floor(1000 + Math.random() * 9000));
    const password = `${palabra}-${numero}`;

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const { error: authErr } = await admin.auth.admin.updateUserById(parsed.data.student_id, { password });
    if (authErr) throw new Error(authErr.message);

    const { error: profErr } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", parsed.data.student_id);
    if (profErr) throw new Error(profErr.message);

    return { ok: true, data: { password } };
  } catch (err) {
    return fail(errorMessage(err, "No se pudo reponer la contraseña."));
  }
}
