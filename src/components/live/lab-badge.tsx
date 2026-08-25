import { cn } from "@/lib/utils";

/** Isologo del Laboratorio de Inteligencia Artificial (Facultad de Derecho, UNT). */
export function LabBadge({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/laboratorio-ia.png"
      alt="Laboratorio de Inteligencia Artificial · Facultad de Derecho UNT"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]", className)}
      style={{ width: size, height: size }}
    />
  );
}
