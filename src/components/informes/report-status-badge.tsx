import { Badge, type BadgeTone } from "@/components/ui";

type ReportStatus = "pending" | "processing" | "ready" | "error";

// Violeta mientras hay IA de por medio (generando o ya generado); el resto en
// gris/rojo neutro. Coherente con el resto del informe (report-view).
const META: Record<ReportStatus, { label: string; tone: BadgeTone; live?: boolean }> = {
  pending: { label: "En cola", tone: "muted" },
  processing: { label: "Generando", tone: "accent-3", live: true },
  ready: { label: "Listo", tone: "accent-3" },
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
