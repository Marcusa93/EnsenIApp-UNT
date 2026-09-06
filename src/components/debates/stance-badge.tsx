import { ThumbsUp, ThumbsDown, Scale } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STANCE_META, DEBATE_STATUS_META, type DebateStance, type DebateStatus } from "./stance";

/**
 * Colores de postura para Debates: "a favor" en verde petróleo (dato/activo),
 * "en contra" en carmesí institucional, "neutral" en gris. `accent-3` (violeta)
 * queda reservado exclusivamente para el contenido generado por IA (ver la
 * síntesis en debate-view.tsx), así que acá no reutilizamos `STANCE_META.tone`
 * tal cual —ese módulo es de sólo lectura y trae "en_contra" en accent-3—.
 */
export interface StanceColor {
  tone: BadgeTone;
  text: string;
  border: string;
  bg: string;
  bar: string;
  ring: string;
}

export const STANCE_COLOR: Record<DebateStance, StanceColor> = {
  a_favor: {
    tone: "accent-2",
    text: "text-accent-2",
    border: "border-accent-2/40",
    bg: "bg-accent-2/10",
    bar: "bg-accent-2",
    ring: "focus-visible:outline-accent-2",
  },
  en_contra: {
    tone: "accent",
    text: "text-accent",
    border: "border-accent/40",
    bg: "bg-accent/10",
    bar: "bg-accent",
    ring: "focus-visible:outline-accent",
  },
  neutral: {
    tone: "muted",
    text: "text-muted",
    border: "border-border",
    bg: "bg-surface-2",
    bar: "bg-muted",
    ring: "focus-visible:outline-ring",
  },
};

export function StanceIcon({ stance, className }: { stance: DebateStance; className?: string }) {
  const cls = cn("size-3.5", className);
  if (stance === "a_favor") return <ThumbsUp className={cls} aria-hidden />;
  if (stance === "en_contra") return <ThumbsDown className={cls} aria-hidden />;
  return <Scale className={cls} aria-hidden />;
}

export function StanceBadge({
  stance,
  size = "sm",
  className,
}: {
  stance: DebateStance;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = STANCE_META[stance];
  const color = STANCE_COLOR[stance];
  return (
    <Badge tone={color.tone} size={size} className={cn("gap-1", className)}>
      <StanceIcon stance={stance} className="size-3" />
      {meta.label}
    </Badge>
  );
}

export function DebateStatusBadge({
  status,
  closedByDate,
  className,
}: {
  status: DebateStatus;
  /** Abierto por estado pero con fecha de cierre vencida */
  closedByDate?: boolean;
  className?: string;
}) {
  if (status === "open" && closedByDate) {
    return (
      <Badge tone="warning" dot className={className}>
        Vencido
      </Badge>
    );
  }
  const meta = DEBATE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot live={status === "open"} className={className}>
      {meta.label}
    </Badge>
  );
}
