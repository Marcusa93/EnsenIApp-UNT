import type { Enums, Tables, UserRole } from "@/lib/types/helpers";
import type { StanceCounts } from "./stance";

export type DebateRow = Tables<"debates">;
export type ArgumentRow = Tables<"debate_arguments">;

export interface ArgumentAuthor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
}

/** Argumento listo para renderizar: autor resuelto, apoyos contados, respuestas anidadas (1 nivel). */
export interface ArgumentView {
  id: string;
  debate_id: string;
  parent_id: string | null;
  stance: Enums<"debate_stance">;
  content: string;
  status: Enums<"argument_status">;
  hidden_reason: string | null;
  hidden_by: string | null;
  author_id: string;
  author: ArgumentAuthor | null;
  created_at: string;
  support_count: number;
  supported_by_me: boolean;
  replies: ArgumentView[];
}

export interface DebateListItem extends DebateRow {
  course: { id: string; name: string; term: string } | null;
  class: { id: string; topic: string; class_date: string } | null;
  counts: StanceCounts;
  argument_count: number;
}

export interface DebateDetail extends DebateRow {
  course: { id: string; name: string; term: string } | null;
  class: { id: string; topic: string; class_date: string } | null;
  recording: { id: string; title: string | null } | null;
  creator: ArgumentAuthor | null;
}
