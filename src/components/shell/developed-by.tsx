import { cn } from "@/lib/utils";
import { LabBadge } from "@/components/live/lab-badge";

export const DYNTEC_NAME = "Laboratorio de IA, Innovación y Transformación Digital DYNTEC";
export const DYNTEC_CREDIT = `Desarrollado por el ${DYNTEC_NAME}`;

export interface DevelopedByProps {
  /**
   * - `line`: una fila (pie de página, pie de sala).
   * - `card`: apilado con el sello (pie del sidebar, portada).
   * - `inline`: chip mínimo para barras y cabeceras.
   */
  variant?: "line" | "card" | "inline";
  /** Tono claro forzado (pantallas siempre oscuras como el proyector). */
  onDark?: boolean;
  className?: string;
}

/**
 * Crédito del Laboratorio DYNTEC (Facultad de Derecho, UNT). Va en todas las
 * pantallas: es quien desarrolla el campus.
 */
export function DevelopedBy({ variant = "line", onDark = false, className }: DevelopedByProps) {
  const muted = onDark ? "text-white/60" : "text-muted";
  const strong = onDark ? "text-white/90" : "text-foreground";

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-[11px] leading-none", muted, className)}>
        <LabBadge size={18} />
        <span>
          Desarrollado por <span className={cn("font-display font-bold", strong)}>DYNTEC</span>
        </span>
      </span>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <LabBadge size={40} className="sello mt-0.5" />
        <div className="min-w-0">
          <p className={cn("eyebrow text-[9px]", onDark && "text-white/55")}>Desarrollado por el</p>
          <p className={cn("mt-1 font-display text-[12px] font-bold leading-snug", strong)}>
            Laboratorio de IA, Innovación y Transformación Digital{" "}
            <span className={onDark ? "text-[#c9a6ee]" : "text-accent-3"}>DYNTEC</span>
          </p>
          <p className={cn("mt-1 text-[11px] leading-snug", muted)}>Facultad de Derecho · UNT</p>
        </div>
      </div>
    );
  }

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs", muted, className)}>
      <LabBadge size={22} />
      <span>
        Desarrollado por el{" "}
        <span className={cn("font-display font-bold", strong)}>
          Laboratorio de IA, Innovación y Transformación Digital{" "}
          <span className={onDark ? "text-[#c9a6ee]" : "text-accent-3"}>DYNTEC</span>
        </span>
      </span>
    </p>
  );
}
