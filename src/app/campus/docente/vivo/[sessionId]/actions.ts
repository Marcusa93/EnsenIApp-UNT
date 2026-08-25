"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacherOfClass } from "@/components/docente/teacher-guard";
import { createClient } from "@/lib/supabase/server";
import { fail, succeed, type ActionResult } from "@/components/docente/types";
import { uuidSchema } from "@/components/docente/class-schema";
import { errorMessage } from "@/lib/utils";

async function loadSessionClassId(sessionId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_sessions").select("class_id").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La sesión no existe.");
  return data.class_id;
}

const setActiveSchema = z.object({ sessionId: uuidSchema, promptId: uuidSchema });

/** Activa una disparadora. Si la sesión estaba en borrador, la pone en vivo. */
export async function setActivePrompt(input: z.input<typeof setActiveSchema>): Promise<ActionResult> {
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");
  try {
    const classId = await loadSessionClassId(parsed.data.sessionId);
    const { supabase } = await requireTeacherOfClass(classId);

    const { data: session, error: sErr } = await supabase
      .from("live_sessions")
      .select("status")
      .eq("id", parsed.data.sessionId)
      .single();
    if (sErr) throw sErr;
    if (session.status === "ended") return fail("Esta sesión ya terminó.");

    const patch: { active_prompt_id: string; status?: "live"; started_at?: string } = {
      active_prompt_id: parsed.data.promptId,
    };
    if (session.status === "draft") {
      patch.status = "live";
      patch.started_at = new Date().toISOString();
    }

    const { error } = await supabase.from("live_sessions").update(patch).eq("id", parsed.data.sessionId);
    if (error) throw error;
    revalidatePath(`/campus/docente/vivo/${parsed.data.sessionId}`);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/vivo] setActivePrompt", { err });
    return fail(errorMessage(err, "No se pudo activar la pregunta."));
  }
}

const idSchema = z.object({ sessionId: uuidSchema });

/** Pausa la pregunta activa sin terminar la sesión (nadie puede responder hasta que actives otra). */
export async function pauseSession(input: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");
  try {
    const classId = await loadSessionClassId(parsed.data.sessionId);
    const { supabase } = await requireTeacherOfClass(classId);
    const { error } = await supabase.from("live_sessions").update({ active_prompt_id: null }).eq("id", parsed.data.sessionId);
    if (error) throw error;
    revalidatePath(`/campus/docente/vivo/${parsed.data.sessionId}`);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/vivo] pauseSession", { err });
    return fail(errorMessage(err, "No se pudo pausar."));
  }
}

export async function endSession(input: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Solicitud inválida.");
  try {
    const classId = await loadSessionClassId(parsed.data.sessionId);
    const { supabase } = await requireTeacherOfClass(classId);
    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString(), active_prompt_id: null })
      .eq("id", parsed.data.sessionId);
    if (error) throw error;
    revalidatePath(`/campus/docente/vivo/${parsed.data.sessionId}`);
    return succeed(undefined);
  } catch (err) {
    console.error("[docente/vivo] endSession", { err });
    return fail(errorMessage(err, "No se pudo finalizar la sesión."));
  }
}
