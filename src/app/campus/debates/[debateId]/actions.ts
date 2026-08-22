"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";
import { isDebateClosed } from "@/components/debates/stance";
import { ARGUMENT_MAX_LENGTH } from "@/components/debates/composer";
import { canModerateCourse } from "../_lib/data";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid("Identificador inválido.");

const postArgumentSchema = z.object({
  debateId: uuid,
  stance: z.enum(["a_favor", "en_contra", "neutral"]),
  content: z
    .string()
    .trim()
    .min(1, "Escribí tu argumento antes de publicar.")
    .max(ARGUMENT_MAX_LENGTH, `El argumento no puede superar los ${ARGUMENT_MAX_LENGTH} caracteres.`),
  parentId: uuid.nullable(),
});

async function requireSession() {
  const ctx = await getOptionalUser();
  if (!ctx) throw new Error("Tu sesión expiró. Volvé a ingresar.");
  if (ctx.profile.status === "bloqueado") throw new Error("Tu cuenta está bloqueada.");
  return ctx;
}

async function loadDebate(debateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debates")
    .select("id, course_id, status, closes_at")
    .eq("id", debateId)
    .maybeSingle();
  if (error) {
    console.error("[debates] loadDebate", { debateId, error });
    throw new Error("No se pudo verificar el debate.");
  }
  if (!data) throw new Error("El debate no existe o no tenés acceso.");
  return { supabase, debate: data };
}

function revalidateDebate(debateId: string) {
  revalidatePath("/campus/debates");
  revalidatePath(`/campus/debates/${debateId}`);
}

/** Publica un argumento (raíz o respuesta). RLS exige debate abierto y membresía del curso. */
export async function postArgument(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = postArgumentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const { debateId, stance, content, parentId } = parsed.data;

    const { user } = await requireSession();
    const { supabase, debate } = await loadDebate(debateId);
    if (isDebateClosed(debate)) return { ok: false, error: "El debate está cerrado: ya no se aceptan argumentos." };

    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("debate_arguments")
        .select("id, debate_id, status")
        .eq("id", parentId)
        .maybeSingle();
      if (parentError || !parent || parent.debate_id !== debateId) {
        return { ok: false, error: "El argumento al que respondés ya no está disponible." };
      }
      if (parent.status !== "visible") return { ok: false, error: "No se puede responder a un argumento oculto." };
    }

    const { data, error } = await supabase
      .from("debate_arguments")
      .insert({ debate_id: debateId, author_id: user.id, stance, content, parent_id: parentId })
      .select("id")
      .single();
    if (error) {
      console.error("[debates] postArgument", { debateId, userId: user.id, error });
      return {
        ok: false,
        error:
          error.code === "42501"
            ? "No podés publicar en este debate (no estás inscripto o ya cerró)."
            : "No se pudo publicar el argumento. Intentá de nuevo.",
      };
    }
    revalidateDebate(debateId);
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const toggleSchema = z.object({ debateId: uuid, argumentId: uuid });

/** Apoyar / quitar apoyo (toggle). Devuelve el estado resultante. */
export async function toggleSupport(input: unknown): Promise<ActionResult<{ supported: boolean }>> {
  try {
    const parsed = toggleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };
    const { debateId, argumentId } = parsed.data;

    const { user } = await requireSession();
    const { supabase, debate } = await loadDebate(debateId);
    if (isDebateClosed(debate)) return { ok: false, error: "El debate está cerrado." };

    const { data: existing, error: readError } = await supabase
      .from("debate_supports")
      .select("argument_id")
      .eq("argument_id", argumentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) {
      console.error("[debates] toggleSupport read", { argumentId, error: readError });
      return { ok: false, error: "No se pudo registrar el apoyo." };
    }

    if (existing) {
      const { error } = await supabase
        .from("debate_supports")
        .delete()
        .eq("argument_id", argumentId)
        .eq("user_id", user.id);
      if (error) {
        console.error("[debates] toggleSupport delete", { argumentId, error });
        return { ok: false, error: "No se pudo quitar el apoyo." };
      }
      revalidateDebate(debateId);
      return { ok: true, data: { supported: false } };
    }

    const { error } = await supabase.from("debate_supports").insert({ argument_id: argumentId, user_id: user.id });
    if (error) {
      console.error("[debates] toggleSupport insert", { argumentId, error });
      return { ok: false, error: "No se pudo registrar el apoyo." };
    }
    revalidateDebate(debateId);
    return { ok: true, data: { supported: true } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const hideSchema = z.object({
  debateId: uuid,
  argumentId: uuid,
  reason: z.string().trim().max(300, "El motivo es demasiado largo.").optional(),
});

async function requireModerator(debateId: string) {
  const { user, profile } = await requireSession();
  const { supabase, debate } = await loadDebate(debateId);
  const allowed = await canModerateCourse(supabase, user.id, profile.role, debate.course_id);
  if (!allowed) throw new Error("Sólo el equipo docente del curso puede moderar este debate.");
  return { supabase, user, debate };
}

/** Oculta un argumento con motivo (el autor lo sigue viendo marcado). */
export async function hideArgument(input: unknown): Promise<ActionResult> {
  try {
    const parsed = hideSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const { debateId, argumentId, reason } = parsed.data;
    const { supabase, user } = await requireModerator(debateId);

    const { error } = await supabase
      .from("debate_arguments")
      .update({ status: "hidden", hidden_by: user.id, hidden_reason: reason || null })
      .eq("id", argumentId)
      .eq("debate_id", debateId);
    if (error) {
      console.error("[debates] hideArgument", { argumentId, error });
      return { ok: false, error: "No se pudo ocultar el argumento." };
    }
    revalidateDebate(debateId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function restoreArgument(input: unknown): Promise<ActionResult> {
  try {
    const parsed = toggleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };
    const { debateId, argumentId } = parsed.data;
    const { supabase } = await requireModerator(debateId);

    const { error } = await supabase
      .from("debate_arguments")
      .update({ status: "visible", hidden_by: null, hidden_reason: null })
      .eq("id", argumentId)
      .eq("debate_id", debateId);
    if (error) {
      console.error("[debates] restoreArgument", { argumentId, error });
      return { ok: false, error: "No se pudo restaurar el argumento." };
    }
    revalidateDebate(debateId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const statusSchema = z.object({
  debateId: uuid,
  status: z.enum(["open", "closed", "archived"]),
});

/** Cerrar / archivar / reabrir. Al reabrir se limpia una fecha de cierre ya vencida. */
export async function setDebateStatus(input: unknown): Promise<ActionResult> {
  try {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };
    const { debateId, status } = parsed.data;
    const { supabase, debate } = await requireModerator(debateId);

    const patch: { status: typeof status; closes_at?: null } = { status };
    if (status === "open" && debate.closes_at && new Date(debate.closes_at).getTime() <= Date.now()) {
      patch.closes_at = null;
    }

    const { error } = await supabase.from("debates").update(patch).eq("id", debateId);
    if (error) {
      console.error("[debates] setDebateStatus", { debateId, status, error });
      return { ok: false, error: "No se pudo actualizar el estado del debate." };
    }
    revalidateDebate(debateId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
