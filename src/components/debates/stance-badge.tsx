import { ThumbsUp, ThumbsDown, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STANCE_META, DEBATE_STATUS_META, type DebateStance, type DebateStatus } from "./stance";

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
  return (
    <Badge tone={meta.tone} size={size} className={cn("gap-1", className)}>
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
