import type { Palette } from "../palette";
import type { ChassisId } from "../palette";
import { depthAt, faceAlpha, place, proj, type Rig } from "../rig";

/**
 * Muñequito de cuerpo entero, proporción chibi.
 *
 * Cada parte declara su ancho Y su profundidad, así al girar la silueta cambia
 * de forma en vez de aplastarse: de perfil la cabeza sigue siendo redonda y el
 * torso conserva cuerpo, que es lo que hace creíble la rotación.
 */

export const Y = {
  headTop: 28,
  headCy: 64,
  headRy: 33,
  neck: 97,
  shoulder: 104,
  chest: 124,
  hip: 158,
  knee: 184,
  foot: 214,
} as const;

/** Medidas del cuerpo: [ancho de frente, profundidad de perfil]. */
export const DIM = {
  head: [66, 60] as const,
  neck: [17, 16] as const,
  shoulders: [64, 54] as const,
  waist: [46, 42] as const,
  leg: [17, 16] as const,
  arm: [13, 13] as const,
} as const;

export function Legs({ p, rig }: { p: Palette; rig: Rig }) {
  const legW = proj(rig, DIM.leg[0], DIM.leg[1]);
  const spread = 14;

  const leg = (lateral: number, key: string) => {
    const cx = place(rig, lateral);
    return (
      <g key={key}>
        <rect x={cx - legW / 2} y={Y.hip - 6} width={legW} height={Y.foot - Y.hip} rx={legW / 2.6} fill={p.clothDark} />
        <rect x={cx - legW / 2} y={Y.knee} width={legW} height="9" rx="3" fill={p.shellDark} />
        {/* Bota: se alarga hacia adelante cuando lo vemos de perfil */}
        <path
          d={`M${cx - legW / 2 - 1} ${Y.foot - 7} L${cx + legW / 2 + 1} ${Y.foot - 7}
              L${cx + legW / 2 + 2 + 7 * Math.abs(rig.s)} ${Y.foot} L${cx - legW / 2 - 2} ${Y.foot} Z`}
          fill={p.shellDark}
        />
      </g>
    );
  };

  // La pierna más lejana se dibuja primero.
  const legs = [-spread, spread].sort((a, b) => depthAt(rig, a) - depthAt(rig, b));
  return <g>{legs.map((l, i) => leg(l, `leg-${i}`))}</g>;
}

export function Arm({ p, rig, side }: { p: Palette; rig: Rig; side: -1 | 1 }) {
  const lateral = 33 * side;
  const forward = 7;
  const cx = place(rig, lateral, forward);
  const armW = proj(rig, DIM.arm[0], DIM.arm[1]);

  return (
    <g>
      {/* Hombrera */}
      <ellipse cx={cx} cy={Y.shoulder + 1} rx={armW * 0.82} ry={armW * 0.7} fill={p.shellDark} />
      <ellipse cx={cx - armW * 0.12} cy={Y.shoulder - 1} rx={armW * 0.6} ry={armW * 0.48} fill={p.shell} opacity="0.7" />
      {/* Brazo hasta la muñeca */}
      <rect
        x={cx - armW / 2}
        y={Y.shoulder + 4}
        width={armW}
        height={Y.hip - Y.shoulder - 6}
        rx={armW / 2}
        fill={p.cloth}
        stroke={p.shellDark}
        strokeWidth="1.6"
      />
      {/* Puño técnico */}
      <rect x={cx - armW / 2} y={Y.hip - 16} width={armW} height="11" rx={armW / 2.6} fill={p.shellDark} />
      <rect x={cx - armW / 2 + 1.5} y={Y.hip - 13} width={Math.max(2, armW - 3)} height="2.4" rx="1.2" fill={p.glow} opacity="0.85" />
      {/* Mano */}
      <circle cx={cx} cy={Y.hip - 1} r={armW * 0.5} fill={p.shellDark} />
    </g>
  );
}

export function Body({ p, rig }: { p: Palette; rig: Rig }) {
  const sh = proj(rig, DIM.shoulders[0], DIM.shoulders[1]) / 2;
  const wa = proj(rig, DIM.waist[0], DIM.waist[1]) / 2;
  const neckW = proj(rig, DIM.neck[0], DIM.neck[1]);
  const c = rig.cx;
  const alpha = faceAlpha(rig);

  return (
    <g>
      {/* Cuello */}
      <rect x={place(rig, 0) - neckW / 2} y={Y.neck - 3} width={neckW} height="11" rx="4" fill={p.shellDark} />

      {/* Torso */}
      <path
        d={`M${c - sh} ${Y.shoulder} Q${c} ${Y.shoulder - 9} ${c + sh} ${Y.shoulder}
            L${c + wa} ${Y.hip} Q${c} ${Y.hip + 7} ${c - wa} ${Y.hip} Z`}
        fill={p.cloth}
      />
      {/* Sombra del costado que se aleja: da volumen al girar */}
      <path
        d={`M${c} ${Y.shoulder - 7} L${c + sh} ${Y.shoulder} L${c + wa} ${Y.hip} L${c} ${Y.hip + 4} Z`}
        fill={p.clothDark}
        opacity={0.2 + 0.3 * Math.max(0, rig.s)}
      />
      <path
        d={`M${c} ${Y.shoulder - 7} L${c - sh} ${Y.shoulder} L${c - wa} ${Y.hip} L${c} ${Y.hip + 4} Z`}
        fill={p.clothDark}
        opacity={0.2 + 0.3 * Math.max(0, -rig.s)}
      />

      {/* Placa pectoral: superficie plana, se va de canto sola */}
      {alpha > 0.05 && (
        <g opacity={alpha}>
          <path
            d={`M${place(rig, 0, 20)} ${Y.shoulder + 8} L${place(rig, 13, 18)} ${Y.chest - 2}
                L${place(rig, 10, 18)} ${Y.hip - 12} L${place(rig, -10, 18)} ${Y.hip - 12}
                L${place(rig, -13, 18)} ${Y.chest - 2} Z`}
            fill={p.shellDark}
          />
          <circle cx={place(rig, 0, 20)} cy={Y.chest + 10} r={proj(rig, 9, 2) / 2 + 2} fill={p.glow} />
          <circle cx={place(rig, 0, 20)} cy={Y.chest + 10} r={proj(rig, 20, 4) / 2 + 3} fill={p.glow} opacity="0.2" />
        </g>
      )}

      {/* Mochila dorsal: la superficie de atrás */}
      {rig.back && (
        <g opacity={Math.min(1, -rig.c * 1.8)}>
          <rect
            x={place(rig, 0, -20) - proj(rig, 32, 6) / 2}
            y={Y.shoulder + 10}
            width={proj(rig, 32, 6)}
            height="34"
            rx="5"
            fill={p.shellDark}
          />
          <rect
            x={place(rig, 0, -20) - proj(rig, 14, 3) / 2}
            y={Y.shoulder + 19}
            width={proj(rig, 14, 3)}
            height="4"
            rx="2"
            fill={p.glow}
            opacity="0.8"
          />
        </g>
      )}

      {/* Cinturón */}
      <rect x={c - wa - 1} y={Y.hip - 9} width={wa * 2 + 2} height="9" rx="3" fill={p.shellDark} />
      <circle cx={place(rig, 0, 16)} cy={Y.hip - 4.5} r="2.6" fill={p.glow} opacity={alpha * 0.9 + 0.1} />
    </g>
  );
}

export function Head({ p, rig, chassis }: { p: Palette; rig: Rig; chassis: ChassisId }) {
  const rx = proj(rig, DIM.head[0], DIM.head[1]) / 2;
  const cx = rig.cx;
  const alpha = faceAlpha(rig);
  // De perfil la cabeza se corre un poco hacia adelante: da sensación de mirada.
  const shift = 2 * rig.s;

  return (
    <g>
      {chassis === "encapuchado" && (
        <path
          d={`M${cx + shift} ${Y.headTop - 9} Q${cx + shift + rx + 9} ${Y.headTop - 3} ${cx + shift + rx + 7} ${Y.headCy + 24}
              L${cx + shift + rx - 3} ${Y.headCy + 17} Q${cx + shift + rx} ${Y.headCy - 15} ${cx + shift} ${Y.headTop + 1}
              Q${cx + shift - rx} ${Y.headCy - 15} ${cx + shift - rx + 3} ${Y.headCy + 17}
              L${cx + shift - rx - 7} ${Y.headCy + 24} Q${cx + shift - rx - 9} ${Y.headTop - 3} ${cx + shift} ${Y.headTop - 9} Z`}
          fill={p.clothDark}
        />
      )}

      {/* Cráneo */}
      {chassis === "angular" ? (
        <path
          d={`M${cx + shift} ${Y.headTop} L${cx + shift + rx} ${Y.headCy - 14} L${cx + shift + rx} ${Y.headCy + 14}
              L${cx + shift + rx * 0.62} ${Y.headCy + Y.headRy - 3} L${cx + shift - rx * 0.62} ${Y.headCy + Y.headRy - 3}
              L${cx + shift - rx} ${Y.headCy + 14} L${cx + shift - rx} ${Y.headCy - 14} Z`}
          fill={p.shell}
        />
      ) : (
        <ellipse cx={cx + shift} cy={Y.headCy} rx={rx} ry={Y.headRy} fill={p.shell} />
      )}

      {/* Sombreado del lado que se aleja */}
      <ellipse
        cx={cx + shift + rx * 0.4 * (rig.s >= 0 ? 1 : -1)}
        cy={Y.headCy}
        rx={rx * 0.6}
        ry={Y.headRy * 0.95}
        fill={p.shellDark}
        opacity="0.26"
      />
      <ellipse cx={cx + shift} cy={Y.headCy - Y.headRy * 0.58} rx={rx * 0.62} ry={Y.headRy * 0.24} fill={p.shellLight} opacity="0.38" />

      {/* Visera que sobresale: de frente casi no se nota, de perfil define el rostro */}
      {Math.abs(rig.s) > 0.15 && (
        <path
          d={`M${place(rig, 0, 28)} ${Y.headCy - 10} Q${place(rig, 0, 40)} ${Y.headCy - 2} ${place(rig, 0, 28)} ${Y.headCy + 8}`}
          fill={p.shellDark}
          opacity={Math.abs(rig.s) * 0.9}
        />
      )}

      {/* Puertos auriculares, uno a cada lado */}
      {[-1, 1].map((side) => {
        const ex = place(rig, side * 30);
        const w = proj(rig, 12, 11);
        return (
          <g key={side}>
            <circle cx={ex} cy={Y.headCy + 5} r={w / 2} fill={p.shellDark} />
            <circle cx={ex} cy={Y.headCy + 5} r={w / 4} fill={p.glow} opacity="0.75" />
          </g>
        );
      })}

      {/* Cresta: ayuda a leer hacia dónde mira */}
      <path
        d={`M${place(rig, 0, -6)} ${Y.headTop + 4} Q${place(rig, 0, 6)} ${Y.headTop - 8} ${place(rig, 0, 16)} ${Y.headTop + 2}`}
        fill="none"
        stroke={p.shellDark}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx={place(rig, 0, 16)} cy={Y.headTop + 2} r="2.8" fill={p.glow} />

      {/* Nuca marcada cuando le vemos la espalda */}
      {rig.back && (
        <path
          d={`M${cx + shift - rx * 0.5} ${Y.headCy + 6} Q${cx + shift} ${Y.headCy + 16} ${cx + shift + rx * 0.5} ${Y.headCy + 6}`}
          fill="none"
          stroke={p.shellDark}
          strokeWidth="3.5"
          opacity="0.55"
        />
      )}
      <g data-alpha={alpha} />
    </g>
  );
}
