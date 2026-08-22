import type { Enums } from "@/lib/types/helpers";

export type DebateStance = Enums<"debate_stance">;
export type DebateStatus = Enums<"debate_status">;

export const STANCES: DebateStance[] = ["a_favor", "en_contra", "neutral"];

export interface StanceMeta {
  label: string;
  short: string;
  tone: "accent-2" | "accent-3" | "muted";
  /** Clases de color para texto / borde / fondo suave */
  text: string;
  border: string;
  bg: string;
  bar: string;
  ring: string;
}

export const STANCE_META: Record<DebateStance, StanceMeta> = {
  a_favor: {
    label: "A favor",
    short: "Favor",
    tone: "accent-2",
    text: "text-accent-2",
    border: "border-accent-2/40",
    bg: "bg-accent-2/10",
    bar: "bg-accent-2",
    ring: "focus-visible:outline-accent-2",
  },
  en_contra: {
    label: "En contra",
    short: "Contra",
    tone: "accent-3",
    text: "text-accent-3",
    border: "border-accent-3/40",
    bg: "bg-accent-3/10",
    bar: "bg-accent-3",
    ring: "focus-visible:outline-accent-3",
  },
  neutral: {
    label: "Neutral",
    short: "Neutral",
    tone: "muted",
    text: "text-muted",
    border: "border-border",
    bg: "bg-surface-2",
    bar: "bg-muted",
    ring: "focus-visible:outline-ring",
  },
};

export const DEBATE_STATUS_META: Record<
  DebateStatus,
  { label: string; tone: "success" | "warning" | "muted" }
> = {
  open: { label: "Abierto", tone: "success" },
  closed: { label: "Cerrado", tone: "warning" },
  archived: { label: "Archivado", tone: "muted" },
};

export interface StanceCounts {
  a_favor: number;
  en_contra: number;
  neutral: number;
}

export function emptyCounts(): StanceCounts {
  return { a_favor: 0, en_contra: 0, neutral: 0 };
}

export function totalCounts(c: StanceCounts): number {
  return c.a_favor + c.en_contra + c.neutral;
}

/** Un debate está efectivamente cerrado si su estado no es "open" o venció closes_at. */
export function isDebateClosed(
  debate: { status: DebateStatus; closes_at: string | null },
  now: Date = new Date(),
): boolean {
  if (debate.status !== "open") return true;
  if (debate.closes_at && new Date(debate.closes_at).getTime() <= now.getTime()) return true;
  return false;
}
