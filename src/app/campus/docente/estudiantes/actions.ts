"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherOf } from "@/components/docente/teacher-guard";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { errorMessage } from "@/lib/utils";
import { rosterEntrySchema } from "./_components/roster-schema";

const PATH = "/campus/docente/estudiantes";

const statusSchema = z.object({
  course_id: z.guid(),
  student_id: z.guid(),
  status: z.enum(["validado", "bloqueado", "pendiente"]),
});

/**
 * Cambia profiles.status de un estudiante inscripto en el curso.
 * RLS sólo permite update a admin; para docentes usamos el cliente admin
 * después de verificar auth_is_teacher_of y que el estudiante esté inscripto.
 */
export async function setStudentStatus(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { course_id, student_id, status } = parsed.data;

  try {
    const { supabase, ctx } = await requireTeacherOf(course_id);
    if (student_id === ctx.user.id) return fail("No podés cambiar tu propio estado.");

    const { data: enrollment, error: eErr } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", course_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (eErr) {
      console.error("[estudiantes] setStudentStatus enrollment", { course_id, student_id, eErr });
      return fail("No se pudo verificar la inscripción.");
    }
    if (!enrollment) return fail("El estudiante no está inscripto en este curso.");

    const admin = createAdminClient();
    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", student_id)
      .maybeSingle();
    if (tErr || !target) return fail("No se encontró el perfil del estudiante.");
    if (target.role !== "estudiante") return fail("Sólo se puede cambiar el estado de estudiantes.");

    const { error } = await admin.from("profiles").update({ status }).eq("id", student_id);
    if (error) {
      console.error("[estudiantes] setStudentStatus update", { student_id, status, error });
      return fail("No se pudo actualizar el estado.");
    }
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${student_id}`);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const upsertSchema = z.object({
  course_id: z.guid(),
  entries: z.array(rosterEntrySchema).min(1, "No hay filas para cargar.").max(2000, "Máximo 2000 filas por carga."),
});

export interface UpsertRosterResult {
  upserted: number;
  matched: number;
}

/** Carga masiva / alta individual del padrón. Upsert por (course_id, email). */
export async function upsertRoster(input: z.input<typeof upsertSchema>): Promise<ActionResult<UpsertRosterResult>> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const { course_id, entries } = parsed.data;

  try {
    const { supabase, ctx } = await requireTeacherOf(course_id);

    // Dedupe por email (último gana) para no romper el ON CONFLICT.
    const byEmail = new Map<string, (typeof entries)[number]>();
    for (const e of entries) byEmail.set(e.email, e);
    const rows = [...byEmail.values()].map((e) => ({
      course_id,
      email: e.email,
      full_name: e.nombre ? e.nombre : null,
      dni: e.dni ? e.dni.replace(/[.\s-]/g, "") : null,
      created_by: ctx.user.id,
    }));

    const { data, error } = await supabase
      .from("roster")
      .upsert(rows, { onConflict: "course_id,email" })
      .select("id, matched_profile_id");
    if (error) {
      console.error("[estudiantes] upsertRoster", { course_id, count: rows.length, error });
      return fail("No se pudo guardar el padrón. Revisá el archivo e intentá de nuevo.");
    }
    revalidatePath(PATH);
    return succeed({
      upserted: data?.length ?? rows.length,
      matched: (data ?? []).filter((r) => r.matched_profile_id).length,
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
}

const deleteSchema = z.object({ course_id: z.guid(), roster_id: z.guid() });

export async function deleteRosterEntry(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { course_id, roster_id } = parsed.data;
  try {
    const { supabase } = await requireTeacherOf(course_id);
    const { error } = await supabase.from("roster").delete().eq("id", roster_id).eq("course_id", course_id);
    if (error) {
      console.error("[estudiantes] deleteRosterEntry", { roster_id, error });
      return fail("No se pudo eliminar la fila del padrón.");
    }
    revalidatePath(PATH);
    return succeed(undefined);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** Contraseña inicial de las cuentas creadas por la cátedra; el estudiante la cambia desde su perfil. */
const INITIAL_PASSWORD = "123456";
const PROVISION_MAX = 200;

export interface ProvisionResult {
  created: number;
  existing: number;
  failed: { email: string; error: string }[];
}

const provisionSchema = z.object({ course_id: z.guid() });

/**
 * Crea cuentas (email + contraseña inicial) para todas las filas del padrón que
 * todavía no tienen usuario. El trigger de alta valida contra el padrón, marca
 * el perfil como validado y lo inscribe en la comisión.
 */
export async function provisionAccounts(input: z.input<typeof provisionSchema>): Promise<ActionResult<ProvisionResult>> {
  const parsed = provisionSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const { course_id } = parsed.data;

  try {
    const { supabase } = await requireTeacherOf(course_id);

    const { data: rows, error } = await supabase
      .from("roster")
      .select("email, full_name")
      .eq("course_id", course_id)
      .is("matched_profile_id", null)
      .limit(PROVISION_MAX);
    if (error) {
      console.error("[estudiantes] provisionAccounts roster", { course_id, error });
      return fail("No se pudo leer el padrón.");
    }
    if (!rows || rows.length === 0) return succeed({ created: 0, existing: 0, failed: [] });

    const admin = createAdminClient();
    const result: ProvisionResult = { created: 0, existing: 0, failed: [] };

    // De a 5 en paralelo: rápido sin golpear el rate limit de la Admin API.
    const queue = [...rows];
    const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (;;) {
        const row = queue.shift();
        if (!row) return;
        const { error: createError } = await admin.auth.admin.createUser({
          email: row.email,
          password: INITIAL_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: row.full_name ?? row.email.split("@")[0],
            role: "estudiante",
          },
        });
        if (!createError) {
          result.created++;
        } else if (/already|registered|exists/i.test(createError.message)) {
          result.existing++;
        } else {
          console.error("[estudiantes] provisionAccounts createUser", { email: row.email, createError });
          result.failed.push({ email: row.email, error: createError.message });
        }
      }
    });
    await Promise.all(workers);

    revalidatePath(PATH);
    return succeed(result);
  } catch (err) {
    return fail(errorMessage(err));
  }
}
