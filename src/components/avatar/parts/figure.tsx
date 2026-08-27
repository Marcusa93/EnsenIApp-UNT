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
  const lateral = 33 * side * rig.shape.shoulders;
  const forward = 7;
  const cx = place(rig, lateral, forward);
  const armW = proj(rig, DIM.arm[0], DIM.arm[1]);

  return (
    <g
      className={side < 0 ? "av-arm av-arm-l" : "av-arm av-arm-r"}
      style={{ transformOrigin: `${cx}px ${Y.shoulder}px` }}
    >
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
  // La silueta sale de la relación entre hombro y cintura, no de una escala única.
  const sh = (proj(rig, DIM.shoulders[0], DIM.shoulders[1]) / 2) * rig.shape.shoulders;
  const wa = (proj(rig, DIM.waist[0], DIM.waist[1]) / 2) * rig.shape.waist;
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
    <g className="av-head" style={{ transformOrigin: `${rig.cx}px ${Y.neck}px` }}>
      {chassis === "encapuchado" && (
        <path
          d={`M${cx + shift} ${Y.headTop - 9} Q${cx + shift + rx + 9} ${Y.headTop - 3} ${cx + shift + rx + 7} ${Y.headCy + 24}
              L${cx + shift + rx - 3} ${Y.headCy + 17} Q${cx + shift + rx} ${Y.headCy - 15} ${cx + shift} ${Y.headTop + 1}
              Q${cx + shift - rx} ${Y.headCy - 15} ${cx + shift - rx + 3} ${Y.headCy + 17}
              L${cx + shift - rx - 7} ${Y.headCy + 24} Q${cx + shift - rx - 9} ${Y.headTop - 3} ${cx + shift} ${Y.headTop - 9} Z`}
          fill={p.clothDark}
        />
      )}

      {/* Cráneo: la silueta es lo que más distingue un modelo de otro */}
      {chassis === "angular" ? (
        <path
          d={`M${cx + shift} ${Y.headTop} L${cx + shift + rx} ${Y.headCy - 14} L${cx + shift + rx} ${Y.headCy + 14}
              L${cx + shift + rx * 0.62} ${Y.headCy + Y.headRy - 3} L${cx + shift - rx * 0.62} ${Y.headCy + Y.headRy - 3}
              L${cx + shift - rx} ${Y.headCy + 14} L${cx + shift - rx} ${Y.headCy - 14} Z`}
          fill={p.shell}
        />
      ) : chassis === "bloque" ? (
        <rect
          x={cx + shift - rx}
          y={Y.headCy - Y.headRy}
          width={rx * 2}
          height={Y.headRy * 2}
          rx={6}
          fill={p.shell}
        />
      ) : chassis === "domo" ? (
        <g>
          {/* Base sólida y cúpula translúcida encima */}
          <rect x={cx + shift - rx * 0.92} y={Y.headCy - 4} width={rx * 1.84} height={Y.headRy + 4} rx={8} fill={p.shell} />
          <path
            d={`M${cx + shift - rx} ${Y.headCy} A${rx} ${Y.headRy + 4} 0 0 1 ${cx + shift + rx} ${Y.headCy} Z`}
            fill={p.shellLight}
            opacity="0.42"
          />
          <path
            d={`M${cx + shift - rx} ${Y.headCy} A${rx} ${Y.headRy + 4} 0 0 1 ${cx + shift + rx} ${Y.headCy}`}
            fill="none"
            stroke={p.shellLight}
            strokeWidth="2.5"
          />
        </g>
      ) : chassis === "antenas" ? (
        <g>
          <ellipse cx={cx + shift} cy={Y.headCy} rx={rx * 0.92} ry={Y.headRy} fill={p.shell} />
          {/* Receptores laterales */}
          {[-1, 1].map((side) => (
            <g key={side}>
              <path
                d={`M${place(rig, side * 27)} ${Y.headCy - 12} L${place(rig, side * 41)} ${Y.headTop - 4}`}
                stroke={p.shellDark}
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx={place(rig, side * 41)} cy={Y.headTop - 5} r="4" fill={p.glow} />
              <circle cx={place(rig, side * 41)} cy={Y.headTop - 5} r="8" fill={p.glow} opacity="0.2" />
            </g>
          ))}
        </g>
      ) : chassis === "visorpleno" ? (
        <g>
          {/* Un solo cristal envolvente: casi no hay carcasa visible */}
          <ellipse cx={cx + shift} cy={Y.headCy} rx={rx} ry={Y.headRy} fill={p.shellDark} />
          <ellipse cx={cx + shift} cy={Y.headCy - 2} rx={rx * 0.88} ry={Y.headRy * 0.86} fill={p.glowDeep} />
          <ellipse
            cx={cx + shift - rx * 0.3}
            cy={Y.headCy - Y.headRy * 0.42}
            rx={rx * 0.34}
            ry={Y.headRy * 0.2}
            fill={p.shellLight}
            opacity="0.5"
          />
        </g>
      ) : chassis === "melena" ? (
        <g>
          {/* Paneles largos que caen sobre los hombros. Van por detrás del
              cráneo para que se lean como volumen y no como orejas pegadas. */}
          {[-1, 1].map((side) => (
            <g key={side}>
              <path
                d={`M${place(rig, side * (rx * 0.78))} ${Y.headCy - Y.headRy * 0.62}
                    Q${place(rig, side * (rx * 1.46))} ${Y.headCy + 8} ${place(rig, side * (rx * 1.22))} ${Y.shoulder + 24}
                    Q${place(rig, side * (rx * 0.96))} ${Y.shoulder + 34} ${place(rig, side * (rx * 0.54))} ${Y.shoulder + 14}
                    Q${place(rig, side * (rx * 0.82))} ${Y.headCy + 4} ${place(rig, side * (rx * 0.52))} ${Y.headCy - Y.headRy * 0.55} Z`}
                fill={p.shellDark}
              />
              {/* Reflejo: sin esto los paneles se funden con la toga oscura */}
              <path
                d={`M${place(rig, side * (rx * 0.86))} ${Y.headCy - Y.headRy * 0.4}
                    Q${place(rig, side * (rx * 1.24))} ${Y.headCy + 10} ${place(rig, side * (rx * 1.06))} ${Y.shoulder + 12}`}
                fill="none"
                stroke={p.shell}
                strokeWidth="3.5"
                opacity="0.75"
                strokeLinecap="round"
              />
            </g>
          ))}
          <ellipse cx={cx + shift} cy={Y.headCy} rx={rx * 0.94} ry={Y.headRy} fill={p.shell} />
          {/* Raya al medio: una línea fina alcanza para sugerir el peinado */}
          <path
            d={`M${place(rig, 0, 6)} ${Y.headCy - Y.headRy + 2} Q${place(rig, 0, 20)} ${Y.headCy - Y.headRy * 0.4} ${place(rig, 0, 14)} ${Y.headCy - Y.headRy * 0.15}`}
            fill="none"
            stroke={p.shellDark}
            strokeWidth="2"
            opacity="0.7"
          />
          {/* Broche luminoso */}
          <circle cx={place(rig, rx * 0.66)} cy={Y.headCy - Y.headRy * 0.42} r="3.4" fill={p.glow} />
          <circle cx={place(rig, rx * 0.66)} cy={Y.headCy - Y.headRy * 0.42} r="7" fill={p.glow} opacity="0.22" />
        </g>
      ) : chassis === "rodete" ? (
        <g>
          {/* Módulo recogido en lo alto: despeja el rostro y alarga la silueta */}
          <circle cx={place(rig, 0, -10)} cy={Y.headTop - 12} r={rx * 0.56} fill={p.shellDark} />
          <circle cx={place(rig, 0, -10)} cy={Y.headTop - 13} r={rx * 0.4} fill={p.shell} opacity="0.8" />
          <circle cx={place(rig, 0, -10)} cy={Y.headTop - 16} r={rx * 0.18} fill={p.shellLight} opacity="0.55" />
          <path
            d={`M${place(rig, -rx * 0.28, -4)} ${Y.headTop - 2} Q${place(rig, 0, -10)} ${Y.headTop - 14} ${place(rig, rx * 0.28, -4)} ${Y.headTop - 2}`}
            fill="none"
            stroke={p.glow}
            strokeWidth="2.4"
            opacity="0.85"
          />
          <ellipse cx={cx + shift} cy={Y.headCy} rx={rx * 0.92} ry={Y.headRy * 0.98} fill={p.shell} />
          {/* Mechones cortos al costado, para que no quede una cabeza pelada */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={`M${place(rig, side * (rx * 0.78))} ${Y.headCy - Y.headRy * 0.4}
                  Q${place(rig, side * (rx * 1.06))} ${Y.headCy + 8} ${place(rig, side * (rx * 0.82))} ${Y.headCy + Y.headRy * 0.72}
                  Q${place(rig, side * (rx * 0.66))} ${Y.headCy + 6} ${place(rig, side * (rx * 0.6))} ${Y.headCy - Y.headRy * 0.35} Z`}
              fill={p.shellDark}
              opacity="0.9"
            />
          ))}
        </g>
      ) : chassis === "trenza" ? (
        <g>
          <ellipse cx={cx + shift} cy={Y.headCy} rx={rx * 0.94} ry={Y.headRy} fill={p.shell} />
          {/* Cable trenzado que cae de un lado: segmentos que se van achicando */}
          {[0, 1, 2, 3, 4].map((i) => {
            const t = i / 4;
            const bx = place(rig, rx * (0.86 + t * 0.16));
            const by = Y.headCy + Y.headRy * 0.3 + i * 15;
            const r = 9.5 - i * 0.9;
            return (
              <g key={i}>
                <ellipse cx={bx} cy={by} rx={r} ry={r * 0.82} fill={p.shellDark} />
                <ellipse cx={bx} cy={by - 1} rx={r * 0.62} ry={r * 0.46} fill={p.shell} opacity="0.8" />
              </g>
            );
          })}
          <circle cx={place(rig, rx * 1.02)} cy={Y.headCy + Y.headRy * 0.3 + 4 * 15 + 8} r="3" fill={p.glow} />
          {/* Cinta sobre la sien */}
          <path
            d={`M${place(rig, -rx * 0.8, 8)} ${Y.headCy - Y.headRy * 0.34} Q${place(rig, 0, 22)} ${Y.headCy - Y.headRy * 0.62} ${place(rig, rx * 0.8, 8)} ${Y.headCy - Y.headRy * 0.34}`}
            fill="none"
            stroke={p.glow}
            strokeWidth="2.6"
            opacity="0.8"
          />
        </g>
      ) : chassis === "crestado" ? (
        <g>
          <ellipse cx={cx + shift} cy={Y.headCy} rx={rx} ry={Y.headRy} fill={p.shell} />
          {/* Cresta dorsal alta */}
          <path
            d={`M${place(rig, 0, -4)} ${Y.headCy - Y.headRy + 2}
                Q${place(rig, 0, -16)} ${Y.headTop - 18} ${place(rig, 0, 4)} ${Y.headTop - 2}
                L${place(rig, 0, 6)} ${Y.headCy - Y.headRy + 6} Z`}
            fill={p.shellDark}
          />
          <path
            d={`M${place(rig, 0, -2)} ${Y.headCy - Y.headRy + 2} Q${place(rig, 0, -12)} ${Y.headTop - 14} ${place(rig, 0, 3)} ${Y.headTop}`}
            fill="none"
            stroke={p.glow}
            strokeWidth="2"
            opacity="0.8"
          />
        </g>
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
