import * as React from "react";
import { buildPalette, type ChassisId, type Palette } from "./palette";
import { makeRig, type Rig } from "./rig";
import { Arm, Body, Head, Legs } from "./parts/figure";
import { VISORES } from "./parts/visor";
import { TOGAS } from "./parts/toga";
import { INSTRUMENTOS } from "./parts/instrumento";
import { COMPANIONS } from "./parts/companion";
import { AURAS, FONDOS } from "./parts/ambiente";
import { cn } from "@/lib/utils";

/**
 * El operador: muñeco de cuerpo entero compuesto por capas SVG, dibujado en
 * función del ángulo hacia el que mira.
 *
 * Orden de dibujo: fondo → aura → pierna/brazo de atrás → cuerpo → toga →
 * cabeza → visor → brazo de adelante → instrumento → compañero. Los brazos se
 * reparten entre "antes" y "después" del cuerpo según de qué lado quedan al
 * girar, que es lo que hace que la rotación se lea como volumen y no como un
 * dibujo que se estira.
 */

export interface AvatarConfig {
  chassis: string;
  tone: string;
  glow: string;
  equipped: Record<string, string | undefined>;
}

export interface OperatorAvatarProps {
  config: AvatarConfig;
  size?: number;
  /** Hacia dónde mira: 0 = de frente, 180 = de espaldas. */
  angle?: number;
  /** Recorta a cabeza y hombros: para chips y listados. */
  bust?: boolean;
  className?: string;
  title?: string;
}

type Part = React.ComponentType<{ p: Palette; rig: Rig }>;

function pick(map: Record<string, Part>, id: string | undefined): Part | null {
  if (!id) return null;
  return map[id] ?? null;
}

export function OperatorAvatar({
  config,
  size = 240,
  angle = 0,
  bust = false,
  className,
  title,
}: OperatorAvatarProps) {
  const p = buildPalette(config.glow, config.tone);
  const rig = makeRig(angle);
  const eq = config.equipped ?? {};
  const clipId = React.useId();

  const Fondo = bust ? null : pick(FONDOS as unknown as Record<string, Part>, eq.fondo);
  const Aura = bust ? null : pick(AURAS as unknown as Record<string, Part>, eq.aura);
  const Companion = bust ? null : pick(COMPANIONS as unknown as Record<string, Part>, eq.companion);
  const Toga = pick(TOGAS as unknown as Record<string, Part>, eq.toga);
  const Visor = pick(VISORES as unknown as Record<string, Part>, eq.visor);
  const Instrumento = bust ? null : pick(INSTRUMENTOS as unknown as Record<string, Part>, eq.instrumento);

  // El brazo que sostiene el instrumento es el de offset negativo. Queda delante
  // del cuerpo mientras esté de nuestro lado.
  const leftArmInFront = rig.s <= 0;

  // El busto encuadra la cabeza; el cuerpo entero, la figura completa.
  const viewBox = bust ? "72 26 96 96" : "0 0 240 240";

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={cn("select-none", className)}
      role="img"
      aria-label={title ?? "Avatar del operador"}
    >
      {title && <title>{title}</title>}

      <defs>
        <clipPath id={clipId}>
          <circle cx="120" cy="120" r="118" />
        </clipPath>
      </defs>

      <g clipPath={bust ? undefined : `url(#${clipId})`}>
        {Fondo ? <Fondo p={p} rig={rig} /> : !bust && <circle cx="120" cy="120" r="118" fill="#12151f" />}
        {Aura && <Aura p={p} rig={rig} />}

        {/* Sombra en el piso: ancla la figura al escenario */}
        {!bust && <ellipse cx="120" cy="222" rx={46 - 10 * (1 - Math.abs(rig.c))} ry="7" fill="#000" opacity="0.35" />}

        <Legs p={p} rig={rig} />
        {!leftArmInFront && <Arm p={p} rig={rig} side={-1} />}
        {leftArmInFront && <Arm p={p} rig={rig} side={1} />}

        <Body p={p} rig={rig} />
        {Toga && <Toga p={p} rig={rig} />}

        <Head p={p} rig={rig} chassis={config.chassis as ChassisId} />
        {Visor && <Visor p={p} rig={rig} />}

        {leftArmInFront && <Arm p={p} rig={rig} side={-1} />}
        {!leftArmInFront && <Arm p={p} rig={rig} side={1} />}

        {Instrumento && <Instrumento p={p} rig={rig} />}
        {Companion && <Companion p={p} rig={rig} />}
      </g>

      {!bust && <circle cx="120" cy="120" r="117" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.32" />}
    </svg>
  );
}
