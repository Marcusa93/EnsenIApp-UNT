"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isTeacherOfCourse } from "@/lib/reports/access";
import { REPORT_SCOPES, reportFiltersSchema, type ReportFilters } from "@/lib/reports/types";
import { errorMessage } from "@/lib/utils";

export interface ActionState {
  error: string | null;
}

const createSchema = z
  .object({
    course_id: z.uuid(),
    scope: z.enum(REPORT_SCOPES),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    class_id: z.string().trim().optional(),
    activity_id: z.string().trim().optional(),
    student_id: z.string().trim().optional(),
    question: z.string().trim().max(600).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "estudiante" && !v.student_id) {
      ctx.addIssue({ code: "custom", path: ["student_id"], message: "Elegí un estudiante." });
    }
    if (v.scope === "clase" && !v.class_id) {
      ctx.addIssue({ code: "custom", path: ["class_id"], message: "Elegí una clase." });
    }
    if (v.from && v.to && v.from > v.to) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "La fecha final no puede ser anterior a la inicial." });
    }
  });

function clean(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/** Crea el pedido (status pending) y redirige al detalle, que dispara la generación. */
export async function createReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, profile } = await requireRole("docente", "admin");

  const raw = Object.fromEntries(
    ["course_id", "scope", "from", "to", "class_id", "activity_id", "student_id", "question"].map((k) => [
      k,
      (formData.get(k) as string | null) ?? undefined,
    ]),
  );
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del formulario." };
  }
  const v = parsed.data;

  if (!(await isTeacherOfCourse(user.id, profile.role, v.course_id))) {
    return { error: "No sos docente de este curso." };
  }

  const filtersRaw: ReportFilters = {
    from: clean(v.from),
    to: clean(v.to),
    class_id: clean(v.class_id),
    activity_id: clean(v.activity_id),
    student_id: clean(v.student_id),
    question: clean(v.question),
  };
  const filters = reportFiltersSchema.safeParse(filtersRaw);
  if (!filters.success) return { error: "Los filtros no son válidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_requests")
    .insert({
      requested_by: user.id,
      course_id: v.course_id,
      scope: v.scope,
      filters: JSON.parse(JSON.stringify(filters.data)),
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[informes] createReport", { error });
    return { error: errorMessage(error, "No se pudo crear el pedido de informe.") };
  }

  revalidatePath("/campus/docente/informes");
  redirect(`/campus/docente/informes/${data.id}?run=1`);
}

export async function deleteReport(reportId: string): Promise<ActionState> {
  const { user, profile } = await requireRole("docente", "admin");
  const id = z.uuid().safeParse(reportId);
  if (!id.success) return { error: "Identificador inválido." };

  const supabase = await createClient();
  // RLS no expone delete: marcamos como error con mensaje para no perder trazabilidad.
  let q = supabase
    .from("report_requests")
    .update({ status: "error", result_md: "Descartado por el docente." })
    .eq("id", id.data);
  if (profile.role !== "admin") q = q.eq("requested_by", user.id);
  const { error } = await q;
  if (error) {
    console.error("[informes] deleteReport", { error });
    return { error: "No se pudo descartar el informe." };
  }
  revalidatePath("/campus/docente/informes");
  return { error: null };
}
