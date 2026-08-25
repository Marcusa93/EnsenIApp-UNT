import type { DbClient } from "@/lib/courses";
import type { LivePrompt, LiveRoomState, LiveSession, WordCount } from "@/lib/live/types";

/** Banco de preguntas de una clase, en orden. Sólo docente/admin (RLS). */
export async function getLivePrompts(supabase: DbClient, classId: string): Promise<LivePrompt[]> {
  const { data, error } = await supabase
    .from("live_prompts")
    .select("*")
    .eq("class_id", classId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Sesiones en vivo de una clase, más recientes primero. Sólo docente/admin (RLS). */
export async function getLiveSessions(supabase: DbClient, classId: string): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Sesión + su banco de preguntas, para la sala de control del docente. */
export async function getSessionForControl(
  supabase: DbClient,
  sessionId: string,
): Promise<{ session: LiveSession; prompts: LivePrompt[] } | null> {
  const { data: session, error } = await supabase.from("live_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!session) return null;
  const prompts = await getLivePrompts(supabase, session.class_id);
  return { session, prompts };
}

/**
 * Resuelve un código a estado de sala pública. Devuelve null si el código no
 * existe o la sesión todavía no arrancó (RLS sólo expone status live/ended).
 */
export async function resolveLiveRoom(supabase: DbClient, code: string): Promise<LiveRoomState | null> {
  const { data: session, error } = await supabase
    .from("live_sessions")
    .select("id, code, status, active_prompt_id, class_id, class_topic")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  let activePrompt: LiveRoomState["activePrompt"] = null;
  if (session.active_prompt_id) {
    const { data: prompt } = await supabase
      .from("live_prompts")
      .select("id, question, type")
      .eq("id", session.active_prompt_id)
      .maybeSingle();
    activePrompt = prompt ?? null;
  }

  return {
    session: {
      id: session.id,
      code: session.code,
      status: session.status,
      active_prompt_id: session.active_prompt_id,
      class_id: session.class_id,
    },
    activePrompt,
    className: session.class_topic ?? "Sesión en vivo",
  };
}

/** Conteo agregado (vista v_live_wordcloud) de un prompt, para el proyector. */
export async function getWordCounts(supabase: DbClient, promptId: string): Promise<WordCount[]> {
  const { data, error } = await supabase
    .from("v_live_wordcloud")
    .select("normalized_word, display_word, frequency")
    .eq("prompt_id", promptId)
    .order("frequency", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WordCount[];
}

/** ¿Ya respondió este usuario al prompt activo? */
export async function hasResponded(supabase: DbClient, promptId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("live_responses")
    .select("word")
    .eq("prompt_id", promptId)
    .eq("participant_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.word ?? null;
}
