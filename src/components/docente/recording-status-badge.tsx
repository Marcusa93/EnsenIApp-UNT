import { Badge, type BadgeTone } from "@/components/ui";
import type { Enums } from "@/lib/types/helpers";

type RecordingStatus = Enums<"recording_status">;

export const RECORDING_STATUS_LABEL: Record<RecordingStatus, string> = {
  uploaded: "Subida",
  transcribing: "Transcribiendo",
  processing: "Procesando",
  generating: "Generando IA",
  ready: "Lista",
  error: "Error",
};

const TONE: Record<RecordingStatus, BadgeTone> = {
  uploaded: "muted",
  transcribing: "accent-2",
  processing: "accent-2",
  generating: "accent",
  ready: "success",
  error: "danger",
};

const IN_PROGRESS: ReadonlySet<RecordingStatus> = new Set(["uploaded", "transcribing", "processing", "generating"]);

export interface RecordingStatusBadgeProps {
  status: RecordingStatus | null | undefined;
  published?: boolean | null;
  /**
   * La clase tiene apunte. Sin grabación, eso no es un hueco: es la otra forma
   * de que la clase tenga contenido, y la pastilla lo dice así.
   */
  hasNote?: boolean;
  size?: "sm" | "md";
}

/** Pastilla de estado del pipeline de una grabación (con punto pulsante si está en proceso). */
export function RecordingStatusBadge({ status, published, hasNote, size = "sm" }: RecordingStatusBadgeProps) {
  if (!status) {
    return hasNote ? (
      <Badge tone="accent-2" size={size}>
        Apunte
      </Badge>
    ) : (
      <Badge tone="muted" size={size}>
        Sin grabación
      </Badge>
    );
  }
  if (status === "ready" && published) {
    return (
      <Badge tone="success" dot size={size}>
        Publicada
      </Badge>
    );
  }
  return (
    <Badge tone={TONE[status]} dot live={IN_PROGRESS.has(status)} size={size}>
      {RECORDING_STATUS_LABEL[status]}
    </Badge>
  );
}
