import { Badge } from "@/components/ui/badge";
import {
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_STATUS_TONE,
  ACTIVITY_TYPE_LABEL,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  type ActivityStatus,
  type ActivityType,
  type SubmissionStatus,
} from "./model";

/* Badges server-safe para estados del módulo. */

export function ActivityStatusBadge({ status, size }: { status: ActivityStatus; size?: "sm" | "md" }) {
  return (
    <Badge tone={ACTIVITY_STATUS_TONE[status]} dot live={status === "published"} size={size}>
      {ACTIVITY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ActivityTypeBadge({ type, size }: { type: ActivityType; size?: "sm" | "md" }) {
  return (
    <Badge tone="accent" size={size}>
      {ACTIVITY_TYPE_LABEL[type]}
    </Badge>
  );
}

export function SubmissionStatusBadge({
  status,
  size,
}: {
  status: SubmissionStatus | null | undefined;
  size?: "sm" | "md";
}) {
  if (!status) {
    return (
      <Badge tone="muted" size={size}>
        Sin empezar
      </Badge>
    );
  }
  return (
    <Badge tone={SUBMISSION_STATUS_TONE[status]} size={size}>
      {SUBMISSION_STATUS_LABEL[status]}
    </Badge>
  );
}
