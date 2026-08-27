import * as React from "react";
import { BUILDS, buildPalette, type ChassisId, type Palette } from "./palette";
import { depthAt, makeRig, type Rig } from "./rig";
import { Arm, Body, Head, Legs } from "./parts/figure";
import { VISORES } from "./parts/visor";
import { TOGAS } from "./parts/toga";
import { INSTRUMENTOS } from "./parts/instrumento";
import { COMPANIONS } from "./parts/companion";
import { AURAS, FONDOS } from "./parts/ambiente";
import { TEMATICOS } from "./parts/tematicos";
import { activeSetClasses } from "@/lib/games/sets";
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
  /** Complexión: id de BUILDS. Si falta, se asume estándar. */
  build?: string;
  equipped: Record<string, string | undefined>;
}

export interface OperatorAvatarProps {
  config: AvatarConfig;
  size?: number;
  /** Hacia dónde mira: 0 = de frente, 180 = de espaldas. */
  angle?: number;
  /** Recorta a cabeza y hombros: para chips y listados. */
  bust?: boolean;
  /**
   * Ranura que se está probando sin tener desbloqueado el ítem: se dibuja como
   * proyección, para que se vea cómo quedaría sin hacerlo pasar por propio.
   */
  ghostSlot?: string | null;
  /** Clase CSS del emote que se está reproduciendo (ver src/lib/games/emotes.ts). */
  emoteClass?: string | null;
  /** Contador de pases: al cambiar, remonta el svg y la animación arranca de cero. */
  emoteKey?: number;
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
  ghostSlot = null,
  emoteClass = null,
  emoteKey = 0,
  className,
  title,
}: OperatorAvatarProps) {
  const p = buildPalette(config.glow, config.tone);
  const rig = makeRig(angle, BUILDS.find((b) => b.id === config.build)?.scale ?? 1);
  const eq = config.equipped ?? {};
  const clipId = React.useId();

  // Cada ranura busca en su catálogo base y en el de los bloques temáticos.
  const catalog = (base: unknown, extra: unknown) =>
    ({ ...(base as Record<string, Part>), ...(extra as Record<string, Part>) }) as Record<string, Part>;

  const Fondo = bust ? null : pick(catalog(FONDOS, TEMATICOS.fondo), eq.fondo);
  const Aura = bust ? null : pick(catalog(AURAS, TEMATICOS.aura), eq.aura);
  const Companion = bust ? null : pick(catalog(COMPANIONS, TEMATICOS.companion), eq.companion);
  const Toga = pick(catalog(TOGAS, TEMATICOS.toga), eq.toga);
  const Visor = pick(catalog(VISORES, TEMATICOS.visor), eq.visor);
  const Instrumento = bust ? null : pick(catalog(INSTRUMENTOS, TEMATICOS.instrumento), eq.instrumento);

  /** Envuelve la pieza que se está probando para que se lea como proyección. */
  const wrap = (slot: string, node: React.ReactNode) =>
    ghostSlot === slot ? (
      <g opacity="0.62" style={{ filter: `drop-shadow(0 0 6px ${p.glow})` }}>
        {node}
      </g>
    ) : (
      node
    );

  // Qué brazo queda delante del cuerpo depende de la profundidad real de cada
  // uno (cuelgan levemente hacia adelante, no sobre el eje).
  const leftArmInFront = depthAt(rig, -33, 7) >= depthAt(rig, 33, 7);

  // El busto encuadra la cabeza; el cuerpo entero, la figura completa.
  const viewBox = bust ? "72 26 96 96" : "0 0 240 240";

  return (
    <svg
      key={`${emoteClass ?? "idle"}-${emoteKey}`}
      viewBox={viewBox}
      width={size}
      height={size}
      // Las clases de emote y de conjunto se concatenan a mano: twMerge (dentro
      // de cn) puede descartar clases que no reconoce, y acá se necesita que
      // lleguen intactas para que enganchen las animaciones.
      className={[cn("select-none", className), emoteClass, bust ? "" : activeSetClasses(eq)]
        .filter(Boolean)
        .join(" ")}
      data-emote={emoteClass ?? "sin-emote"}
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
        {Aura && wrap("aura", <Aura p={p} rig={rig} />)}

        {/* Sombra en el piso: ancla la figura al escenario */}
        {!bust && <ellipse cx="120" cy="222" rx={46 - 10 * (1 - Math.abs(rig.c))} ry="7" fill="#000" opacity="0.35" />}

        <Legs p={p} rig={rig} />
        {!leftArmInFront && <Arm p={p} rig={rig} side={-1} />}
        {leftArmInFront && <Arm p={p} rig={rig} side={1} />}

        <Body p={p} rig={rig} />
        {Toga && wrap("toga", <Toga p={p} rig={rig} />)}

        <Head p={p} rig={rig} chassis={config.chassis as ChassisId} />
        {Visor && wrap("visor", <Visor p={p} rig={rig} />)}

        {leftArmInFront && <Arm p={p} rig={rig} side={-1} />}
        {!leftArmInFront && <Arm p={p} rig={rig} side={1} />}

        {Instrumento && wrap("instrumento", <Instrumento p={p} rig={rig} />)}
        {Companion && wrap("companion", <Companion p={p} rig={rig} />)}
      </g>

      {!bust && <circle cx="120" cy="120" r="117" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.32" />}
    </svg>
  );
}
