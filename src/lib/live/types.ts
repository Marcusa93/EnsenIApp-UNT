import type { Tables } from "@/lib/types/helpers";

export type LivePrompt = Tables<"live_prompts">;
export type LiveSession = Tables<"live_sessions">;
export type LiveResponse = Tables<"live_responses">;

export interface WordCount {
  normalized_word: string;
  display_word: string;
  frequency: number;
}

/** Lo que necesita la sala del estudiante / el proyector para renderizar el estado actual. */
export interface LiveRoomState {
  session: Pick<LiveSession, "id" | "code" | "status" | "active_prompt_id" | "class_id">;
  activePrompt: Pick<LivePrompt, "id" | "question" | "type"> | null;
  className: string;
}
