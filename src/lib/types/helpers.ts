import type { Database } from "./database";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

export type Profile = Tables<"profiles">;
export type UserRole = Enums<"user_role">;
export type ClassSession = Tables<"classes">;
export type ClassRecording = Tables<"class_recordings">;
export type Activity = Tables<"activities">;
export type Debate = Tables<"debates">;

/** Shapes of JSONB columns — the DB stores `Json`; cast at the boundary with these. */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface SummarySection {
  title: string;
  body_md: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export type InteractiveCardItem =
  | { type: "flashcard"; question: string; answer: string; tag?: string }
  | {
      type: "quiz";
      question: string;
      options: string[];
      correct_index: number;
      explanation: string;
      tag?: string;
    }
  | { type: "concept"; title: string; body_md: string; tag?: string };

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

/** activities.content for type='cuestionario' */
export interface QuizContent {
  questions: QuizQuestion[];
}

/** activities.content for type='lectura' | 'entrega' */
export interface TextContent {
  body_md?: string;
  material_ids?: string[];
  allow_file_upload?: boolean;
}

/** usage_events.event_type taxonomy — keep in sync with docs/ARCHITECTURE.md */
export type UsageEventType =
  | "page_view"
  | "class_opened"
  | "recording_played"
  | "summary_read"
  | "simplified_read"
  | "transcript_opened"
  | "card_flipped"
  | "card_marked"
  | "quiz_answered"
  | "cards_session_completed"
  | "activity_viewed"
  | "activity_started"
  | "activity_answer_changed"
  | "activity_submitted"
  | "checkin_submitted"
  | "question_asked"
  | "poll_answered"
  | "debate_opened"
  | "argument_posted"
  | "argument_supported"
  | "feedback_generated"
  | "focus_lost"
  | "focus_gained"
  | "offline_queued"
  | "offline_flushed"
  | "game_started"
  | "game_finished"
  | "duel_created"
  | "duel_finished";
