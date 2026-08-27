import * as React from "react";
import { buildPalette, type ChassisId } from "./palette";
import { Head, Torso } from "./parts/base";
import { VISORES } from "./parts/visor";
import { TOGAS } from "./parts/toga";
import { INSTRUMENTOS } from "./parts/instrumento";
import { COMPANIONS } from "./parts/companion";
import { AURAS, FONDOS } from "./parts/ambiente";
import { cn } from "@/lib/utils";

/**
 * El operador, compuesto por capas SVG.
 *
 * Orden de dibujo (de atrás hacia adelante): fondo → aura → compañero → torso →
 * toga → cabeza → visor → instrumento. Todo vive en un viewBox de 240×240, así
 * que el mismo componente sirve para el retrato grande del vestidor y para el
 * chip de 32px de la tabla de posiciones.
 */

export interface AvatarConfig {
  chassis: string;
  tone: string;
  glow: string;
  equipped: Record<string, string | undefined>;
}

export interface OperatorAvatarProps {
  config: AvatarConfig;
  /** Lado del cuadro en px. */
  size?: number;
  /** Apaga fondo y compañero: para chips y listados. */
  bust?: boolean;
  className?: string;
  title?: string;
}

function pick<T extends Record<string, React.ComponentType<{ p: ReturnType<typeof buildPalette> }>>>(
  map: T,
  id: string | undefined,
) {
  if (!id) return null;
  return (map as Record<string, React.ComponentType<{ p: ReturnType<typeof buildPalette> }>>)[id] ?? null;
}

export function OperatorAvatar({ config, size = 240, bust = false, className, title }: OperatorAvatarProps) {
  const p = buildPalette(config.glow, config.tone);
  const eq = config.equipped ?? {};

  const Fondo = bust ? null : pick(FONDOS, eq.fondo);
  const Aura = pick(AURAS, eq.aura);
  const Companion = bust ? null : pick(COMPANIONS, eq.companion);
  const Toga = pick(TOGAS, eq.toga);
  const Visor = pick(VISORES, eq.visor);
  const Instrumento = bust ? null : pick(INSTRUMENTOS, eq.instrumento);

  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={cn("select-none", className)}
      role="img"
      aria-label={title ?? "Avatar del operador"}
    >
      {title && <title>{title}</title>}

      {/* Recorte circular: el retrato siempre es un disco */}
      <defs>
        <clipPath id="av-clip">
          <circle cx="120" cy="120" r="118" />
        </clipPath>
      </defs>

      <g clipPath="url(#av-clip)">
        {Fondo ? <Fondo p={p} /> : <circle cx="120" cy="120" r="118" fill="#12151f" />}
        {Aura && <Aura p={p} />}
        {Companion && <Companion p={p} />}
        <Torso p={p} />
        {Toga && <Toga p={p} />}
        <Head p={p} chassis={config.chassis as ChassisId} />
        {Visor && <Visor p={p} />}
        {Instrumento && <Instrumento p={p} />}
      </g>

      <circle cx="120" cy="120" r="117" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.32" />
    </svg>
  );
}
