import type { Palette } from "../palette";
import type { ChassisId } from "../palette";
import { px, pw, protrude, type Rig } from "../rig";

/**
 * Muñequito de cuerpo entero, proporción chibi (la cabeza pesa: es lo que hace
 * que se lea como personaje de juego y no como maniquí).
 *
 * Alturas fijas en el lienzo de 240×240 — el giro sólo cambia anchos y posiciones
 * horizontales, nunca la altura, así la figura no "salta" al rotar.
 */

export const Y = {
  headTop: 26,
  headCy: 60,
  headRy: 34,
  neck: 96,
  shoulder: 106,
  waist: 152,
  hip: 162,
  kneeTop: 186,
  foot: 216,
} as const;

/** Piernas: van primero, detrás del torso. */
export function Legs({ p, rig }: { p: Palette; rig: Rig }) {
  const spread = 15;
  const legW = pw(rig, 17, 0.55);
  const lx = px(rig, -spread);
  const rx = px(rig, spread);

  const leg = (cx: number, key: string) => (
    <g key={key}>
      <rect x={cx - legW / 2} y={Y.hip - 4} width={legW} height={Y.foot - Y.hip - 6} rx={legW / 2.4} fill={p.clothDark} />
      {/* Rodillera */}
      <rect x={cx - legW / 2} y={Y.kneeTop} width={legW} height="9" rx="3" fill={p.shellDark} />
      {/* Bota */}
      <path
        d={`M${cx - legW / 2 - 1} ${Y.foot - 8} L${cx + legW / 2 + 1} ${Y.foot - 8} L${cx + legW / 2 + 3} ${Y.foot} L${cx - legW / 2 - 3} ${Y.foot} Z`}
        fill={p.shellDark}
      />
      <rect x={cx - legW / 2 - 3} y={Y.foot - 2} width={legW + 6} height="3" rx="1.5" fill={p.shell} opacity="0.7" />
    </g>
  );

  // De perfil, la pierna de atrás va primero para que no se superponga mal.
  const order = rig.s >= 0 ? [lx, rx] : [rx, lx];
  return <g>{order.map((cx, i) => leg(cx, `leg-${i}`))}</g>;
}

/** Brazos. Se dibujan en dos pasadas: los de atrás antes del torso, los de adelante después. */
export function Arm({
  p,
  rig,
  side,
}: {
  p: Palette;
  rig: Rig;
  /** -1 = brazo a nuestra izquierda, +1 = a nuestra derecha. */
  side: -1 | 1;
}) {
  const offset = 34 * side;
  const cx = px(rig, offset);
  const armW = pw(rig, 13, 0.6);

  return (
    <g>
      {/* Hombrera */}
      <ellipse cx={cx} cy={Y.shoulder + 2} rx={armW * 0.85} ry={armW * 0.72} fill={p.shellDark} />
      <ellipse cx={cx} cy={Y.shoulder} rx={armW * 0.7} ry={armW * 0.55} fill={p.shell} opacity="0.75" />
      {/* Brazo */}
      <rect x={cx - armW / 2} y={Y.shoulder + 4} width={armW} height={Y.waist - Y.shoulder + 4} rx={armW / 2} fill={p.cloth} />
      {/* Antebrazo con acento */}
      <rect x={cx - armW / 2} y={Y.waist - 14} width={armW} height="12" rx={armW / 2.4} fill={p.shellDark} />
      <rect x={cx - armW / 2 + 1.5} y={Y.waist - 11} width={armW - 3} height="2.5" rx="1.2" fill={p.glow} opacity="0.85" />
      {/* Mano */}
      <circle cx={cx} cy={Y.waist + 6} r={armW * 0.52} fill={p.shellDark} />
    </g>
  );
}

export function Body({ p, rig }: { p: Palette; rig: Rig }) {
  const shoulderW = pw(rig, 62, 0.42);
  const waistW = pw(rig, 46, 0.5);
  const half = shoulderW / 2;
  const wHalf = waistW / 2;

  return (
    <g>
      {/* Cuello */}
      <rect x={px(rig, 0) - pw(rig, 16, 0.6) / 2} y={Y.neck - 6} width={pw(rig, 16, 0.6)} height="14" rx="4" fill={p.shellDark} />

      {/* Torso */}
      <path
        d={`M${rig.cx - half} ${Y.shoulder} Q${rig.cx} ${Y.shoulder - 8} ${rig.cx + half} ${Y.shoulder}
            L${rig.cx + wHalf} ${Y.hip} Q${rig.cx} ${Y.hip + 6} ${rig.cx - wHalf} ${Y.hip} Z`}
        fill={p.cloth}
      />
      {/* Volumen lateral: el lado que se aleja queda en sombra */}
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx + half} ${Y.shoulder} L${rig.cx + wHalf} ${Y.hip} L${rig.cx} ${Y.hip + 3} Z`}
        fill={p.clothDark}
        opacity={0.2 + 0.3 * Math.max(0, rig.s)}
      />
      <path
        d={`M${rig.cx} ${Y.shoulder - 6} L${rig.cx - half} ${Y.shoulder} L${rig.cx - wHalf} ${Y.hip} L${rig.cx} ${Y.hip + 3} Z`}
        fill={p.clothDark}
        opacity={0.2 + 0.3 * Math.max(0, -rig.s)}
      />

      {/* Placa pectoral: sólo cuando le vemos el frente */}
      {!rig.back && (
        <g opacity={Math.min(1, Math.abs(rig.c) * 1.6)}>
          <path
            d={`M${rig.cx} ${Y.shoulder + 8} L${px(rig, 13)} ${Y.shoulder + 18} L${px(rig, 10)} ${Y.waist - 4} L${px(rig, -10)} ${Y.waist - 4} L${px(rig, -13)} ${Y.shoulder + 18} Z`}
            fill={p.shellDark}
          />
          <circle cx={rig.cx} cy={Y.shoulder + 26} r={pw(rig, 9, 0.3) / 2} fill={p.glow} />
          <circle cx={rig.cx} cy={Y.shoulder + 26} r={pw(rig, 18, 0.3) / 2} fill={p.glow} opacity="0.22" />
        </g>
      )}

      {/* Mochila dorsal: aparece al darse vuelta */}
      {rig.back && (
        <g opacity={Math.min(1, Math.abs(rig.c) * 1.6)}>
          <rect
            x={rig.cx - pw(rig, 30, 0.3) / 2}
            y={Y.shoulder + 10}
            width={pw(rig, 30, 0.3)}
            height="34"
            rx="5"
            fill={p.shellDark}
          />
          <rect
            x={rig.cx - pw(rig, 14, 0.3) / 2}
            y={Y.shoulder + 18}
            width={pw(rig, 14, 0.3)}
            height="4"
            rx="2"
            fill={p.glow}
            opacity="0.8"
          />
        </g>
      )}

      {/* Cinturón */}
      <rect
        x={rig.cx - waistW / 2 - 1}
        y={Y.hip - 8}
        width={waistW + 2}
        height="9"
        rx="3"
        fill={p.shellDark}
      />
      <circle cx={px(rig, 0)} cy={Y.hip - 3.5} r="2.6" fill={p.glow} opacity={rig.back ? 0.3 : 0.9} />
    </g>
  );
}

export function Head({ p, rig, chassis }: { p: Palette; rig: Rig; chassis: ChassisId }) {
  const rx = pw(rig, 34, 0.62) / 2 + 17 * (1 - Math.abs(rig.c)) * 0.35;
  const headRx = Math.max(20, pw(rig, 68, 0.72) / 2);
  const cx = rig.cx + protrude(rig, 3);

  const shell = (
    <>
      {chassis === "angular" ? (
        <path
          d={`M${cx} ${Y.headTop} L${cx + headRx} ${Y.headCy - 16} L${cx + headRx} ${Y.headCy + 16} L${cx + headRx * 0.6} ${Y.headCy + Y.headRy - 4}
              L${cx - headRx * 0.6} ${Y.headCy + Y.headRy - 4} L${cx - headRx} ${Y.headCy + 16} L${cx - headRx} ${Y.headCy - 16} Z`}
          fill={p.shell}
        />
      ) : (
        <ellipse cx={cx} cy={Y.headCy} rx={headRx} ry={Y.headRy} fill={p.shell} />
      )}
      {/* Sombra del lado que se aleja */}
      <ellipse
        cx={cx + headRx * 0.42 * (rig.s >= 0 ? 1 : -1)}
        cy={Y.headCy}
        rx={headRx * 0.58}
        ry={Y.headRy * 0.94}
        fill={p.shellDark}
        opacity="0.28"
      />
      {/* Brillo superior */}
      <ellipse cx={cx} cy={Y.headCy - Y.headRy * 0.55} rx={headRx * 0.66} ry={Y.headRy * 0.26} fill={p.shellLight} opacity="0.4" />
    </>
  );

  return (
    <g>
      {chassis === "encapuchado" && (
        <path
          d={`M${cx} ${Y.headTop - 8} Q${cx + headRx + 10} ${Y.headTop - 2} ${cx + headRx + 8} ${Y.headCy + 22}
              L${cx + headRx - 2} ${Y.headCy + 16} Q${cx + headRx + 2} ${Y.headCy - 14} ${cx} ${Y.headTop + 2}
              Q${cx - headRx - 2} ${Y.headCy - 14} ${cx - headRx + 2} ${Y.headCy + 16}
              L${cx - headRx - 8} ${Y.headCy + 22} Q${cx - headRx - 10} ${Y.headTop - 2} ${cx} ${Y.headTop - 8} Z`}
          fill={p.clothDark}
        />
      )}
      {shell}
      {/* Puertos auriculares: uno a cada lado, se corren al girar */}
      {[-1, 1].map((side) => {
        const ex = px(rig, side * 31);
        const visible = Math.abs(rig.c) > 0.25 || side * rig.s < 0;
        if (!visible) return null;
        return (
          <g key={side}>
            <circle cx={ex} cy={Y.headCy + 6} r={pw(rig, 12, 0.5) / 2} fill={p.shellDark} />
            <circle cx={ex} cy={Y.headCy + 6} r={pw(rig, 5, 0.5) / 2} fill={p.glow} opacity="0.8" />
          </g>
        );
      })}
      {/* Antena/cresta que ayuda a leer la orientación */}
      <rect x={cx - pw(rig, 8, 0.3) / 2} y={Y.headTop - 4} width={pw(rig, 8, 0.3)} height="8" rx="3" fill={p.shellDark} />
      <circle cx={cx} cy={Y.headTop - 5} r="2.6" fill={p.glow} />
      {/* Nuca: marca clara de que lo estamos viendo de atrás */}
      {rig.back && (
        <path
          d={`M${cx - headRx * 0.5} ${Y.headCy + 4} Q${cx} ${Y.headCy + 14} ${cx + headRx * 0.5} ${Y.headCy + 4}`}
          fill="none"
          stroke={p.shellDark}
          strokeWidth="3"
          opacity="0.6"
        />
      )}
      {/* rx se usa para que los visores sepan cuánto ancho tienen disponible */}
      <g data-head-rx={rx} />
    </g>
  );
}
