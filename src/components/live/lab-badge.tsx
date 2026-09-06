import { cn } from "@/lib/utils";

/**
 * Isologo del Laboratorio de IA, Innovación y Transformación Digital DYNTEC
 * (Facultad de Derecho, UNT). Es circular con fondo blanco: se muestra siempre
 * sobre blanco para que el trazo negro y la pluma violeta no se pierdan en "tinta".
 */
export function LabBadge({ size = 56, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/laboratorio-ia.png"
      alt="Laboratorio de IA, Innovación y Transformación Digital DYNTEC · Facultad de Derecho UNT"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]", className)}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}
