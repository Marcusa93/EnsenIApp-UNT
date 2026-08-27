import type { Palette } from "../palette";
import { px, pw, protrude, type Rig } from "../rig";
import { Y } from "./figure";

/**
 * Visores: el módulo de análisis, en el lugar del rostro. Se dibujan contra el
 * rig, así que se angostan y se corren solos al girar la figura. De espaldas no
 * se dibujan (ahí se le ve la nuca).
 */

export interface PartProps {
  p: Palette;
  rig: Rig;
}

/** Banda del visor: alto fijo, ancho y centro según hacia dónde mira. */
function band(rig: Rig, width: number) {
  const w = pw(rig, width, 0.3);
  const cx = rig.cx + protrude(rig, 4);
  return { w, cx, x: cx - w / 2 };
}

export function VisorBasico({ p, rig }: PartProps) {
  if (rig.back) return null;
  const { x, w, cx } = band(rig, 50);
  const eye = pw(rig, 14, 0.25);
  return (
    <g opacity={Math.min(1, Math.abs(rig.c) * 2)}>
      <rect x={x} y={Y.headCy - 10} width={w} height="18" rx="9" fill={p.shellDark} />
      <rect x={x + w * 0.07} y={Y.headCy - 6} width={w * 0.86} height="10" rx="5" fill={p.glowDeep} />
      <rect x={px(rig, -11) - eye / 2} y={Y.headCy - 3.5} width={eye} height="5" rx="2.5" fill={p.glow} />
      <rect x={px(rig, 11) - eye / 2} y={Y.headCy - 3.5} width={eye} height="5" rx="2.5" fill={p.glow} />
      <g data-cx={cx} />
    </g>
  );
}

export function VisorLente({ p, rig }: PartProps) {
  if (rig.back) return null;
  const { x, w } = band(rig, 56);
  return (
    <g opacity={Math.min(1, Math.abs(rig.c) * 2)}>
      <rect x={x} y={Y.headCy - 12} width={w} height="21" rx="10.5" fill={p.shellDark} />
      <rect x={x + w * 0.07} y={Y.headCy - 8} width={w * 0.86} height="13" rx="6.5" fill={p.glowDeep} />
      <rect x={px(rig, -12) - pw(rig, 15, 0.25) / 2} y={Y.headCy - 4} width={pw(rig, 15, 0.25)} height="6" rx="3" fill={p.glow} />
      <rect x={px(rig, 12) - pw(rig, 15, 0.25) / 2} y={Y.headCy - 4} width={pw(rig, 15, 0.25)} height="6" rx="3" fill={p.glow} />
      {/* Lente de aumento sobre un ojo */}
      <ellipse
        cx={px(rig, 16)}
        cy={Y.headCy - 1}
        rx={pw(rig, 22, 0.3) / 2}
        ry="11"
        fill="none"
        stroke={p.shellLight}
        strokeWidth="2.4"
      />
      <ellipse cx={px(rig, 16)} cy={Y.headCy - 1} rx={pw(rig, 22, 0.3) / 2} ry="11" fill={p.glow} opacity="0.2" />
    </g>
  );
}

export function VisorTactico({ p, rig }: PartProps) {
  if (rig.back) return null;
  const { x, w, cx } = band(rig, 62);
  return (
    <g opacity={Math.min(1, Math.abs(rig.c) * 2)}>
      <path
        d={`M${x} ${Y.headCy - 14} Q${cx} ${Y.headCy - 20} ${x + w} ${Y.headCy - 14} L${x + w + 1} ${Y.headCy + 8} Q${cx} ${Y.headCy + 15} ${x - 1} ${Y.headCy + 8} Z`}
        fill={p.shellDark}
      />
      <path
        d={`M${x + 4} ${Y.headCy - 10} Q${cx} ${Y.headCy - 15} ${x + w - 4} ${Y.headCy - 10} L${x + w - 4} ${Y.headCy + 5} Q${cx} ${Y.headCy + 11} ${x + 4} ${Y.headCy + 5} Z`}
        fill={p.glowDeep}
      />
      <rect x={px(rig, -13) - pw(rig, 16, 0.25) / 2} y={Y.headCy - 5} width={pw(rig, 16, 0.25)} height="7" rx="3" fill={p.glow} />
      <rect x={px(rig, 13) - pw(rig, 16, 0.25) / 2} y={Y.headCy - 5} width={pw(rig, 16, 0.25)} height="7" rx="3" fill={p.glow} />
      {/* Antena lateral: se ve del lado que gira hacia nosotros */}
      <g transform={`translate(${px(rig, 30)} ${Y.headCy - 12})`}>
        <path d="M0 0 L10 -12 L14 -8 L4 4 Z" fill={p.shell} />
        <circle cx="12" cy="-10" r="3.5" fill={p.glow} />
        <circle cx="12" cy="-10" r="7" fill={p.glow} opacity="0.25" />
      </g>
    </g>
  );
}

export function VisorCorona({ p, rig }: PartProps) {
  const { x, w, cx } = band(rig, 66);
  const ringRx = pw(rig, 74, 0.3) / 2;
  return (
    <g>
      {/* El anillo sí se ve de espaldas: rodea la cabeza */}
      <ellipse cx={rig.cx} cy={Y.headTop - 2} rx={ringRx} ry={Math.max(4, ringRx * 0.26)} fill="none" stroke={p.glow} strokeWidth="2.5" opacity="0.85" />
      <ellipse cx={rig.cx} cy={Y.headTop - 2} rx={ringRx} ry={Math.max(4, ringRx * 0.26)} fill="none" stroke={p.glow} strokeWidth="6" opacity="0.15" />
      {[-1, -0.5, 0, 0.5, 1].map((t, i) => (
        <circle
          key={i}
          cx={rig.cx + ringRx * t}
          cy={Y.headTop - 2 + Math.max(4, ringRx * 0.26) * Math.sin(Math.acos(t)) * (i % 2 ? 1 : -1)}
          r="3"
          fill={p.glow}
        />
      ))}
      {!rig.back && (
        <g opacity={Math.min(1, Math.abs(rig.c) * 2)}>
          <path
            d={`M${x} ${Y.headCy - 14} Q${cx} ${Y.headCy - 21} ${x + w} ${Y.headCy - 14} L${x + w + 1} ${Y.headCy + 10} Q${cx} ${Y.headCy + 18} ${x - 1} ${Y.headCy + 10} Z`}
            fill={p.shellDark}
          />
          <path
            d={`M${x + 4} ${Y.headCy - 10} Q${cx} ${Y.headCy - 16} ${x + w - 4} ${Y.headCy - 10} L${x + w - 4} ${Y.headCy + 7} Q${cx} ${Y.headCy + 14} ${x + 4} ${Y.headCy + 7} Z`}
            fill={p.glowDeep}
          />
          <path
            d={`M${x + 7} ${Y.headCy - 3} Q${cx} ${Y.headCy - 7} ${x + w - 7} ${Y.headCy - 3} L${x + w - 7} ${Y.headCy + 3} Q${cx} ${Y.headCy + 8} ${x + 7} ${Y.headCy + 3} Z`}
            fill={p.glow}
            opacity="0.9"
          />
        </g>
      )}
    </g>
  );
}

export function VisorMagistral({ p, rig }: PartProps) {
  const { x, w, cx } = band(rig, 70);
  const spread = pw(rig, 70, 0.3) / 2;
  return (
    <g>
      {/* Laurel geométrico: envuelve la cabeza, se ve de todos los ángulos */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${rig.cx} ${Y.headTop - 10} Q${rig.cx + side * spread * 0.7} ${Y.headTop - 14} ${rig.cx + side * spread} ${Y.headTop + 6}`}
          fill="none"
          stroke={p.glow}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      {[-0.85, -0.45, 0.45, 0.85].map((t, i) => (
        <g key={i}>
          <circle cx={rig.cx + spread * t} cy={Y.headTop - 10 + Math.abs(t) * 12} r="3.6" fill={p.glow} />
          <circle cx={rig.cx + spread * t} cy={Y.headTop - 10 + Math.abs(t) * 12} r="7.5" fill={p.glow} opacity="0.2" />
        </g>
      ))}
      <path d={`M${rig.cx} ${Y.headTop - 16} L${rig.cx + 6} ${Y.headTop - 10} L${rig.cx} ${Y.headTop - 4} L${rig.cx - 6} ${Y.headTop - 10} Z`} fill={p.shellLight} />

      {!rig.back && (
        <g opacity={Math.min(1, Math.abs(rig.c) * 2)}>
          <path
            d={`M${x} ${Y.headCy - 16} Q${cx} ${Y.headCy - 23} ${x + w} ${Y.headCy - 16} L${x + w + 1} ${Y.headCy + 12} Q${cx} ${Y.headCy + 20} ${x - 1} ${Y.headCy + 12} Z`}
            fill={p.shellDark}
          />
          <path
            d={`M${x + 4} ${Y.headCy - 12} Q${cx} ${Y.headCy - 18} ${x + w - 4} ${Y.headCy - 12} L${x + w - 4} ${Y.headCy + 9} Q${cx} ${Y.headCy + 16} ${x + 4} ${Y.headCy + 9} Z`}
            fill={p.glowDeep}
          />
          <path
            d={`M${x + 7} ${Y.headCy - 4} Q${cx} ${Y.headCy - 9} ${x + w - 7} ${Y.headCy - 4} L${x + w - 7} ${Y.headCy + 4} Q${cx} ${Y.headCy + 10} ${x + 7} ${Y.headCy + 4} Z`}
            fill={p.glow}
          />
          <rect x={px(rig, -14) - pw(rig, 10, 0.25) / 2} y={Y.headCy - 10} width={pw(rig, 10, 0.25)} height="18" rx="3" fill={p.shellLight} opacity="0.9" />
          <rect x={px(rig, 14) - pw(rig, 10, 0.25) / 2} y={Y.headCy - 10} width={pw(rig, 10, 0.25)} height="18" rx="3" fill={p.shellLight} opacity="0.9" />
        </g>
      )}
    </g>
  );
}

export const VISORES = {
  "visor-basico": VisorBasico,
  "visor-lente": VisorLente,
  "visor-tactico": VisorTactico,
  "visor-corona": VisorCorona,
  "visor-magistral": VisorMagistral,
} as const;
