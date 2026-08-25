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
