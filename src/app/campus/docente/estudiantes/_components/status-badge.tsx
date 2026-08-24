import { Badge, type BadgeTone } from "@/components/ui";
import type { ProfileStatus } from "./students-data";

const META: Record<ProfileStatus, { label: string; tone: BadgeTone }> = {
  validado: { label: "Validado", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warning" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
};

export function StudentStatusBadge({ status, size = "sm" }: { status: ProfileStatus; size?: "sm" | "md" }) {
  const m = META[status];
  return (
    <Badge tone={m.tone} dot size={size}>
      {m.label}
    </Badge>
  );
}
