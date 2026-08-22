import { Badge, type BadgeTone } from "@/components/ui";

type ReportStatus = "pending" | "processing" | "ready" | "error";

const META: Record<ReportStatus, { label: string; tone: BadgeTone; live?: boolean }> = {
  pending: { label: "En cola", tone: "muted" },
  processing: { label: "Generando", tone: "accent-2", live: true },
  ready: { label: "Listo", tone: "success" },
  error: { label: "Error", tone: "danger" },
};

export function ReportStatusBadge({ status, size = "md" }: { status: ReportStatus; size?: "sm" | "md" }) {
  const m = META[status];
  return (
    <Badge tone={m.tone} dot live={m.live} size={size}>
      {m.label}
    </Badge>
  );
}
