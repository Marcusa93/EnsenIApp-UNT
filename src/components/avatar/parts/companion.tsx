import type { Palette } from "../palette";
import { px, type Rig } from "../rig";
import { Y } from "./figure";
import type { PartProps } from "./visor";

/**
 * Compañeros: orbitan al operador. Se ganan con RACHA, no con XP — son el premio
 * a volver, así que tienen que notarse. Al girar la figura acompañan la órbita y
 * se achican cuando pasan por detrás.
 */

/** Posición orbital: `offset` es la distancia lateral cuando se mira de frente. */
function orbit(rig: Rig, offset: number, y: number) {
  const behind = Math.max(0, offset * rig.s) / Math.abs(offset || 1);
  return {
    x: px(rig, offset),
    y,
    scale: 1 - 0.28 * behind,
    opacity: 1 - 0.55 * behind,
  };
}

function Dron({ p, x, y, scale = 1 }: { p: Palette; x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="15" rx="13" ry="3.5" fill={p.glow} opacity="0.14" />
      <path d="M-13 0 Q-13 -10 0 -10 Q13 -10 13 0 Q13 8 0 8 Q-13 8 -13 0 Z" fill={p.shellDark} />
      <path d="M-10 -2 Q-10 -7 0 -7 Q10 -7 10 -2 Z" fill={p.shell} opacity="0.8" />
      <circle cx="0" cy="1" r="4.5" fill={p.glowDeep} />
      <circle cx="0" cy="1" r="2.8" fill={p.glow} />
      <path d="M-13 -4 L-19 -7 M13 -4 L19 -7" stroke={p.shellDark} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="-20" cy="-8" rx="6.5" ry="2" fill={p.glow} opacity="0.5" />
      <ellipse cx="20" cy="-8" rx="6.5" ry="2" fill={p.glow} opacity="0.5" />
    </g>
  );
}

export function CompDron({ p, rig }: PartProps) {
  const o = orbit(rig, 52, Y.shoulder - 6);
  return (
    <g opacity={o.opacity}>
      <Dron p={p} x={o.x} y={o.y} scale={o.scale} />
    </g>
  );
}

export function CompAsesor({ p, rig }: PartProps) {
  const o = orbit(rig, 56, Y.shoulder - 12);
  const panelW = 46 * o.scale;
  return (
    <g opacity={o.opacity}>
      <Dron p={p} x={o.x} y={o.y} scale={o.scale * 1.1} />
      {/* Panel de sugerencias proyectado */}
      <g transform={`translate(${o.x} ${o.y + 26}) scale(${o.scale})`}>
        <path d={`M${-panelW / 2} 0 L${panelW / 2} 0 L${panelW / 2 - 4} 28 L${-panelW / 2 + 4} 28 Z`} fill={p.glowDeep} opacity="0.5" />
        <path
          d={`M${-panelW / 2} 0 L${panelW / 2} 0 L${panelW / 2 - 4} 28 L${-panelW / 2 + 4} 28 Z`}
          fill="none"
          stroke={p.glow}
          strokeWidth="1.4"
          opacity="0.8"
        />
        <path d="M-14 8 L14 8 M-13 15 L11 15 M-12 22 L5 22" stroke={p.glow} strokeWidth="1.7" opacity="0.9" strokeLinecap="round" />
      </g>
    </g>
  );
}

export function CompEnjambre({ p, rig }: PartProps) {
  const a = orbit(rig, 54, Y.shoulder - 16);
  const b = orbit(rig, 64, Y.waist + 4);
  const c = orbit(rig, -50, Y.hip - 10);
  return (
    <g>
      <g opacity={c.opacity}>
        <Dron p={p} x={c.x} y={c.y} scale={c.scale * 0.6} />
      </g>
      <g opacity={a.opacity}>
        <Dron p={p} x={a.x} y={a.y} scale={a.scale * 0.88} />
      </g>
      <g opacity={b.opacity}>
        <Dron p={p} x={b.x} y={b.y} scale={b.scale * 0.68} />
      </g>
      <path
        d={`M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} Z`}
        fill="none"
        stroke={p.glow}
        strokeWidth="1.1"
        opacity="0.3"
        strokeDasharray="3 4"
      />
    </g>
  );
}

export function CompTestigo({ p, rig }: PartProps) {
  const o = orbit(rig, 54, Y.shoulder + 4);
  const r = 7 * o.scale;
  return (
    <g opacity={o.opacity}>
      <circle cx={o.x} cy={o.y} r={r * 1.5} fill="none" stroke={p.glow} strokeWidth="1.4" opacity="0.4" />
      <circle cx={o.x} cy={o.y} r={r * 2.6} fill="none" stroke={p.glow} strokeWidth="1" opacity="0.2" />
      <circle cx={o.x} cy={o.y} r={r} fill={p.shellDark} />
      <circle cx={o.x} cy={o.y} r={r * 0.55} fill={p.glow} />
      <circle cx={o.x} cy={o.y} r={r * 1.3} fill={p.glow} opacity="0.25" />
      {/* Marca de tiempo flotante */}
      <g transform={`translate(${o.x} ${o.y + 34}) scale(${o.scale})`}>
        <rect x="-23" y="-9" width="46" height="17" rx="4" fill={p.glowDeep} opacity="0.6" />
        <rect x="-23" y="-9" width="46" height="17" rx="4" fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.7" />
        <text x="0" y="3" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill={p.glow}>
          23:41
        </text>
      </g>
    </g>
  );
}

export const COMPANIONS = {
  "comp-dron": CompDron,
  "comp-asesor": CompAsesor,
  "comp-enjambre": CompEnjambre,
  "comp-testigo": CompTestigo,
} as const;
