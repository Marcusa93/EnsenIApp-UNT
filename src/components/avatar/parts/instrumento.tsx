import type { Palette } from "../palette";
import { depthAt, place, proj, type Rig } from "../rig";
import { Y } from "./figure";
import type { PartProps } from "./visor";

/**
 * Instrumentos de litigio: van en la mano izquierda del operador (nuestra
 * derecha del lienzo cuando mira de frente). Nunca son armas — son las
 * herramientas con las que se litiga.
 *
 * Al girar acompañan a la mano, y cuando quedan detrás del cuerpo se atenúan.
 */

/** Punto donde está la mano que sostiene, y cuánto se ve desde este ángulo. */
function grip(rig: Rig) {
  const lateral = -33;
  const forward = 12;
  const behind = depthAt(rig, lateral, forward) < 0;
  return {
    x: place(rig, lateral, forward),
    y: Y.hip - 2,
    front: behind ? 0.4 : 1,
    // Escala chica: sostenido en la mano, no puede competir con el torso.
    scale: 0.5 + 0.16 * Math.abs(rig.c),
  };
}

export function InstCodice({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      {/* Códice abierto: dos tapas y el lomo iluminado */}
      <path d="M-26 -14 L-2 -24 L-2 14 L-26 24 Z" fill={p.shellDark} />
      <path d="M26 -14 L2 -24 L2 14 L26 24 Z" fill={p.shell} />
      <path d="M-23 -11 L-4 -19 L-4 10 L-23 18 Z" fill={p.shellLight} opacity="0.22" />
      <path d="M23 -11 L4 -19 L4 10 L23 18 Z" fill={p.shellLight} opacity="0.14" />
      <path d="M0 -22 L0 14" stroke={p.glow} strokeWidth="2.4" opacity="0.9" />
      <path d="M-20 -5 L-7 -10 M-20 2 L-7 -3 M-20 9 L-10 5" stroke={p.glow} strokeWidth="1.5" opacity="0.7" strokeLinecap="round" />
      <path d="M20 -5 L7 -10 M20 2 L7 -3 M17 9 L7 5" stroke={p.glow} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
    </g>
  );
}

export function InstMazo({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <path d="M-4 26 L8 -12" stroke={p.shellDark} strokeWidth="7" strokeLinecap="round" />
      <path d="M-4 26 L8 -12" stroke={p.shell} strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(-24 8 -16)">
        <rect x="-10" y="-27" width="36" height="22" rx="5" fill={p.shellDark} />
        <rect x="-7" y="-24" width="30" height="16" rx="3" fill={p.shell} />
        <rect x="-10" y="-19" width="36" height="7" fill={p.glow} opacity="0.75" />
      </g>
      {/* Onda de impacto */}
      <path d="M-16 16 Q-6 12 2 16" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path d="M-20 23 Q-6 17 6 23" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.28" strokeLinecap="round" />
    </g>
  );
}

export function InstBalanza({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <path d="M0 30 L0 -22" stroke={p.shellDark} strokeWidth="5" strokeLinecap="round" />
      <path d="M-24 -18 L24 -18" stroke={p.shellDark} strokeWidth="4" strokeLinecap="round" />
      <circle cx="0" cy="-24" r="5" fill={p.glow} />
      <circle cx="0" cy="-24" r="10" fill={p.glow} opacity="0.22" />
      <path d="M-24 -18 L-24 -5" stroke={p.shell} strokeWidth="2" />
      <path d="M24 -18 L24 3" stroke={p.shell} strokeWidth="2" />
      <path d="M-34 -5 Q-24 7 -14 -5 Z" fill={p.shellDark} />
      <path d="M14 3 Q24 15 34 3 Z" fill={p.shellDark} />
      <path d="M-32 -5 Q-24 4 -16 -5" fill={p.glow} opacity="0.5" />
      <path d="M16 3 Q24 12 32 3" fill={p.glow} opacity="0.5" />
      <path d="M0 26 L-9 36 L9 36 Z" fill={p.shellDark} />
    </g>
  );
}

export function InstSello({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <path d="M-11 -6 L11 -6 L15 14 L-15 14 Z" fill={p.shellDark} />
      <rect x="-6" y="-26" width="12" height="20" rx="5" fill={p.shell} />
      <circle cx="0" cy="-28" r="8" fill={p.shellDark} />
      <circle cx="0" cy="-28" r="4" fill={p.glow} />
      <rect x="-18" y="14" width="36" height="8" rx="3" fill={p.shell} />
      <ellipse cx="0" cy="34" rx="26" ry="8" fill={p.glow} opacity="0.16" />
      <ellipse cx="0" cy="34" rx="16" ry="5" fill="none" stroke={p.glow} strokeWidth="2" />
      <path d="M-6 34 L-2 38 L7 30" fill="none" stroke={p.glow} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function InstMagno({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <path d="M-32 -6 Q0 -16 0 -6 L0 26 Q0 16 -32 26 Z" fill={p.shellDark} />
      <path d="M32 -6 Q0 -16 0 -6 L0 26 Q0 16 32 26 Z" fill={p.shell} />
      <path d="M0 -8 L0 26" stroke={p.glowDeep} strokeWidth="2.4" />
      <path d="M-24 0 L-8 -4 M-24 7 L-8 3 M-24 14 L-12 11" stroke={p.glow} strokeWidth="1.6" opacity="0.8" strokeLinecap="round" />
      <path d="M24 0 L8 -4 M24 7 L8 3 M20 14 L8 11" stroke={p.glow} strokeWidth="1.6" opacity="0.8" strokeLinecap="round" />
      {/* Glifos que se elevan */}
      {[
        [-14, -26, 3.4],
        [0, -36, 4.4],
        [14, -26, 3.4],
        [0, -20, 2.4],
      ].map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={p.glow} opacity={0.9 - i * 0.12} />
          <circle cx={cx} cy={cy} r={Number(r) * 2.2} fill={p.glow} opacity="0.14" />
        </g>
      ))}
    </g>
  );
}

export const INSTRUMENTOS = {
  "inst-codice": InstCodice,
  "inst-mazo": InstMazo,
  "inst-balanza": InstBalanza,
  "inst-sello": InstSello,
  "inst-magno": InstMagno,
} as const;

