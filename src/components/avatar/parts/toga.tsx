import type { Palette } from "../palette";
import { faceAlpha, place, proj, px, type Rig } from "../rig";
import { Y } from "./figure";
import type { PartProps } from "./visor";

/**
 * Togas: prenda de cuerpo entero, desde los hombros hasta cerca de los pies.
 * Se dibujan contra el rig para que la falda se angoste al girar; de espaldas
 * cambian las solapas por la caída lisa de la tela.
 */

/** Silueta de la prenda: hombros → cintura → vuelo de la falda. */
function robePath(rig: Rig, shoulder: number, hem: number, bottom: number) {
  // La prenda es un volumen: de perfil conserva cuerpo en vez de aplastarse.
  const sh = proj(rig, shoulder, shoulder * 0.55) / 2;
  const wa = proj(rig, shoulder * 0.74, shoulder * 0.5) / 2;
  const he = proj(rig, hem, hem * 0.62) / 2;
  const c = rig.cx;
  return `M${c - sh} ${Y.shoulder} Q${c} ${Y.shoulder - 8} ${c + sh} ${Y.shoulder}
          L${c + wa} ${Y.hip} L${c + he} ${bottom} Q${c} ${bottom + 6} ${c - he} ${bottom} L${c - wa} ${Y.hip} Z`;
}

function Lapels({ p, rig, top, glowEdge }: PartProps & { top: number; glowEdge?: boolean }) {
  if (rig.back) return null;
  const w = proj(rig, 22, 22 * 0.5);
  const vBottom = Y.hip - 4;
  return (
    <g opacity={faceAlpha(rig)}>
      <path
        d={`M${px(rig, -18)} ${top} L${rig.cx} ${vBottom} L${px(rig, -10)} ${Y.foot - 8} L${px(rig, -26)} ${Y.foot - 8} Z`}
        fill={p.clothDark}
      />
      <path
        d={`M${px(rig, 18)} ${top} L${rig.cx} ${vBottom} L${px(rig, 10)} ${Y.foot - 8} L${px(rig, 26)} ${Y.foot - 8} Z`}
        fill={p.clothDark}
      />
      {glowEdge && (
        <path
          d={`M${px(rig, -18)} ${top} L${rig.cx} ${vBottom} L${px(rig, 18)} ${top}`}
          fill="none"
          stroke={p.glow}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}
      <g data-w={w} />
    </g>
  );
}

export function TogaCursante({ p, rig }: PartProps) {
  return (
    <g>
      <path d={robePath(rig, 60, 74, Y.foot - 6)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx + proj(rig, 60, 60 * 0.5) / 2} ${Y.shoulder} L${rig.cx + proj(rig, 74, 74 * 0.5) / 2} ${Y.foot - 6} L${rig.cx} ${Y.foot} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.28 * Math.max(0, rig.s)}
      />
      <Lapels p={p} rig={rig} top={Y.shoulder + 2} />
    </g>
  );
}

export function TogaReforzada({ p, rig }: PartProps) {
  return (
    <g>
      <path d={robePath(rig, 62, 78, Y.foot - 4)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx + proj(rig, 62, 62 * 0.5) / 2} ${Y.shoulder} L${rig.cx + proj(rig, 78, 78 * 0.5) / 2} ${Y.foot - 4} L${rig.cx} ${Y.foot} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.28 * Math.max(0, rig.s)}
      />
      <Lapels p={p} rig={rig} top={Y.shoulder} />
      {/* Costuras horizontales */}
      <path
        d={`M${rig.cx - proj(rig, 66, 66 * 0.5) / 2} ${Y.hip + 22} L${rig.cx + proj(rig, 66, 66 * 0.5) / 2} ${Y.hip + 22}`}
        stroke={p.shellDark}
        strokeWidth="1.6"
        opacity="0.55"
      />
    </g>
  );
}

export function TogaFibra({ p, rig }: PartProps) {
  const hem = proj(rig, 82, 82 * 0.5) / 2;
  return (
    <g>
      <path d={robePath(rig, 64, 82, Y.foot - 4)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx + proj(rig, 64, 64 * 0.5) / 2} ${Y.shoulder} L${rig.cx + hem} ${Y.foot - 4} L${rig.cx} ${Y.foot} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.28 * Math.max(0, rig.s)}
      />
      <Lapels p={p} rig={rig} top={Y.shoulder - 2} glowEdge />
      {/* Fibra que corre por el ruedo y los costados */}
      <path
        d={`M${rig.cx - hem} ${Y.foot - 6} Q${rig.cx} ${Y.foot} ${rig.cx + hem} ${Y.foot - 6}`}
        fill="none"
        stroke={p.glow}
        strokeWidth="2.2"
        opacity="0.8"
      />
      <path d={`M${px(rig, -28)} ${Y.hip} L${px(rig, -33)} ${Y.foot - 8}`} stroke={p.glow} strokeWidth="1.8" opacity="0.65" />
      <path d={`M${px(rig, 28)} ${Y.hip} L${px(rig, 33)} ${Y.foot - 8}`} stroke={p.glow} strokeWidth="1.8" opacity="0.65" />
    </g>
  );
}

export function TogaProcesal({ p, rig }: PartProps) {
  return (
    <g>
      <path d={robePath(rig, 66, 86, Y.foot - 2)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx + proj(rig, 66, 66 * 0.5) / 2} ${Y.shoulder} L${rig.cx + proj(rig, 86, 86 * 0.5) / 2} ${Y.foot - 2} L${rig.cx} ${Y.foot} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.3 * Math.max(0, rig.s)}
      />
      {/* Placas laterales de blindaje */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${px(rig, side * 26)} ${Y.hip - 6} L${px(rig, side * 36)} ${Y.hip + 2} L${px(rig, side * 34)} ${Y.knee} L${px(rig, side * 24)} ${Y.knee - 6} Z`}
          fill={p.shellDark}
        />
      ))}
      <Lapels p={p} rig={rig} top={Y.shoulder - 4} glowEdge />
      {!rig.back && (
        <path
          d={`M${rig.cx} ${Y.hip + 4} L${px(rig, 7)} ${Y.hip + 16} L${rig.cx} ${Y.foot - 10} L${px(rig, -7)} ${Y.hip + 16} Z`}
          fill={p.glow}
          opacity="0.8"
        />
      )}
    </g>
  );
}

export function TogaCorte({ p, rig }: PartProps) {
  const sh = proj(rig, 70, 70 * 0.5) / 2;
  return (
    <g>
      <path d={robePath(rig, 70, 92, Y.foot)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx + sh} ${Y.shoulder} L${rig.cx + proj(rig, 92, 92 * 0.5) / 2} ${Y.foot} L${rig.cx} ${Y.foot + 4} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.3 * Math.max(0, rig.s)}
      />
      {/* Muceta sobre los hombros: se ve de frente y de espaldas */}
      <path
        d={`M${rig.cx - sh - 4} ${Y.shoulder + 4} Q${rig.cx} ${Y.shoulder - 12} ${rig.cx + sh + 4} ${Y.shoulder + 4}
            Q${rig.cx} ${Y.shoulder + 26} ${rig.cx - sh - 4} ${Y.shoulder + 4} Z`}
        fill={p.clothDark}
      />
      <path
        d={`M${rig.cx - sh - 4} ${Y.shoulder + 4} Q${rig.cx} ${Y.shoulder - 12} ${rig.cx + sh + 4} ${Y.shoulder + 4}`}
        fill="none"
        stroke={p.glow}
        strokeWidth="2.4"
        opacity="0.85"
      />
      <Lapels p={p} rig={rig} top={Y.shoulder + 14} glowEdge />
      {/* Ruedo con ribete pleno */}
      <path
        d={`M${rig.cx - proj(rig, 92, 92 * 0.5) / 2} ${Y.foot - 2} Q${rig.cx} ${Y.foot + 4} ${rig.cx + proj(rig, 92, 92 * 0.5) / 2} ${Y.foot - 2}`}
        fill="none"
        stroke={p.glow}
        strokeWidth="2.6"
      />
      {!rig.back && (
        <g>
          <path
            d={`M${rig.cx} ${Y.hip + 10} L${px(rig, 9)} ${Y.hip + 22} L${rig.cx} ${Y.hip + 36} L${px(rig, -9)} ${Y.hip + 22} Z`}
            fill={p.glow}
          />
          <circle cx={rig.cx} cy={Y.hip + 23} r={proj(rig, 34, 34 * 0.5) / 2} fill={p.glow} opacity="0.12" />
        </g>
      )}
    </g>
  );
}

export const TOGAS = {
  "toga-cursante": TogaCursante,
  "toga-reforzada": TogaReforzada,
  "toga-fibra": TogaFibra,
  "toga-procesal": TogaProcesal,
  "toga-corte": TogaCorte,
} as const;
