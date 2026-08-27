import { depthAt, faceAlpha, place, proj } from "../rig";
import { Y } from "./figure";
import type { PartProps } from "./visor";

/**
 * Equipo de los bloques temáticos del programa: ciberdelito, datos personales,
 * bioderecho, criptoeconomía e IA generativa. Mismo rig que el resto — cada
 * pieza se dibuja según hacia dónde mira la figura.
 */

// ----------------------------------------------------------------- VISORES

export function VisorForense({ p, rig }: PartProps) {
  if (rig.back) return null;
  const w = proj(rig, 58, 10);
  const cx = place(rig, 0, 26);
  const x = cx - w / 2;
  return (
    <g opacity={faceAlpha(rig)}>
      <rect x={x} y={Y.headCy - 12} width={w} height="21" rx="6" fill={p.shellDark} />
      <rect x={x + w * 0.06} y={Y.headCy - 8} width={w * 0.88} height="13" rx="4" fill={p.glowDeep} />
      {/* Retícula de análisis */}
      <path d={`M${x + w * 0.2} ${Y.headCy - 8} L${x + w * 0.2} ${Y.headCy + 5}`} stroke={p.glow} strokeWidth="1.2" opacity="0.7" />
      <path d={`M${x + w * 0.8} ${Y.headCy - 8} L${x + w * 0.8} ${Y.headCy + 5}`} stroke={p.glow} strokeWidth="1.2" opacity="0.7" />
      <path d={`M${x + 3} ${Y.headCy - 1.5} L${x + w - 3} ${Y.headCy - 1.5}`} stroke={p.glow} strokeWidth="1.6" opacity="0.9" />
      <rect x={place(rig, -10, 26) - proj(rig, 9, 6) / 2} y={Y.headCy - 5} width={proj(rig, 9, 6)} height="7" rx="1.5" fill={p.glow} />
      <rect x={place(rig, 12, 26) - proj(rig, 9, 6) / 2} y={Y.headCy - 5} width={proj(rig, 9, 6)} height="7" rx="1.5" fill={p.glow} opacity="0.65" />
      {/* Lupa de rastro */}
      <circle cx={place(rig, 26, 26)} cy={Y.headCy - 14} r={proj(rig, 13, 5) / 2} fill="none" stroke={p.shellLight} strokeWidth="2" />
    </g>
  );
}

export function VisorBioetica({ p, rig }: PartProps) {
  const alpha = faceAlpha(rig);
  const w = proj(rig, 62, 10);
  const cx = place(rig, 0, 26);
  const x = cx - w / 2;
  const arcRx = proj(rig, 78, 12) / 2;
  return (
    <g>
      {/* Doble hélice sobre la cabeza: se ve desde cualquier ángulo */}
      <g className="av-spin-slow" style={{ transformOrigin: `${rig.cx}px ${Y.headTop - 4}px` }}>
        {[0, 1].map((k) => (
          <path
            key={k}
            d={`M${rig.cx - arcRx} ${Y.headTop - 4} Q${rig.cx} ${Y.headTop - 4 + (k ? 14 : -14)} ${rig.cx + arcRx} ${Y.headTop - 4}`}
            fill="none"
            stroke={p.glow}
            strokeWidth="2.2"
            opacity="0.8"
          />
        ))}
        {[-0.6, -0.2, 0.2, 0.6].map((t, i) => (
          <line
            key={i}
            x1={rig.cx + arcRx * t}
            y1={Y.headTop - 12}
            x2={rig.cx + arcRx * t}
            y2={Y.headTop + 4}
            stroke={p.glow}
            strokeWidth="1.4"
            opacity="0.45"
          />
        ))}
      </g>
      {!rig.back && (
        <g opacity={alpha}>
          <path
            d={`M${x} ${Y.headCy - 13} Q${cx} ${Y.headCy - 19} ${x + w} ${Y.headCy - 13} L${x + w} ${Y.headCy + 9} Q${cx} ${Y.headCy + 16} ${x} ${Y.headCy + 9} Z`}
            fill={p.shellDark}
          />
          <path
            d={`M${x + 4} ${Y.headCy - 9} Q${cx} ${Y.headCy - 14} ${x + w - 4} ${Y.headCy - 9} L${x + w - 4} ${Y.headCy + 6} Q${cx} ${Y.headCy + 12} ${x + 4} ${Y.headCy + 6} Z`}
            fill={p.glowDeep}
          />
          <path d={`M${x + 8} ${Y.headCy - 1} Q${cx} ${Y.headCy - 6} ${x + w - 8} ${Y.headCy - 1}`} fill="none" stroke={p.glow} strokeWidth="2.4" />
        </g>
      )}
    </g>
  );
}

// ------------------------------------------------------------------- TOGAS

function robe(rig: PartProps["rig"], shoulder: number, hem: number, bottom: number) {
  const sh = proj(rig, shoulder, shoulder * 0.9) / 2;
  const wa = proj(rig, shoulder * 0.74, shoulder * 0.72) / 2;
  const he = proj(rig, hem, hem * 0.9) / 2;
  const c = rig.cx;
  return `M${c - sh} ${Y.shoulder - 2} Q${c} ${Y.shoulder - 12} ${c + sh} ${Y.shoulder - 2}
          L${c + wa} ${Y.hip} L${c + he} ${bottom} Q${c} ${bottom + 6} ${c - he} ${bottom} L${c - wa} ${Y.hip} Z`;
}

export function TogaBioderecho({ p, rig }: PartProps) {
  const alpha = faceAlpha(rig);
  return (
    <g>
      <path d={robe(rig, 62, 80, Y.foot - 4)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 8} L${rig.cx + proj(rig, 62, 56) / 2} ${Y.shoulder} L${rig.cx + proj(rig, 80, 72) / 2} ${Y.foot - 4} L${rig.cx} ${Y.foot} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.28 * Math.max(0, rig.s)}
      />
      {alpha > 0.05 && (
        <g opacity={alpha}>
          {/* Solapas con hélice bordada */}
          <path d={`M${place(rig, -18, 16)} ${Y.shoulder} L${rig.cx} ${Y.hip - 6} L${place(rig, -26, 14)} ${Y.foot - 8} L${place(rig, -34, 12)} ${Y.foot - 8} Z`} fill={p.clothDark} />
          <path d={`M${place(rig, 18, 16)} ${Y.shoulder} L${rig.cx} ${Y.hip - 6} L${place(rig, 26, 14)} ${Y.foot - 8} L${place(rig, 34, 12)} ${Y.foot - 8} Z`} fill={p.clothDark} />
          <path
            d={`M${place(rig, -14, 18)} ${Y.chest - 4} Q${place(rig, 0, 20)} ${Y.chest + 6} ${place(rig, 14, 18)} ${Y.chest - 4}`}
            fill="none"
            stroke={p.glow}
            strokeWidth="2"
            opacity="0.85"
          />
          <path
            d={`M${place(rig, -14, 18)} ${Y.chest + 10} Q${place(rig, 0, 20)} ${Y.chest} ${place(rig, 14, 18)} ${Y.chest + 10}`}
            fill="none"
            stroke={p.glow}
            strokeWidth="2"
            opacity="0.6"
          />
        </g>
      )}
    </g>
  );
}

export function TogaCripto({ p, rig }: PartProps) {
  const alpha = faceAlpha(rig);
  const cols = [-1, 0, 1];
  return (
    <g>
      <path d={robe(rig, 64, 84, Y.foot - 2)} fill={p.cloth} />
      <path
        d={`M${rig.cx} ${Y.shoulder - 8} L${rig.cx + proj(rig, 64, 58) / 2} ${Y.shoulder} L${rig.cx + proj(rig, 84, 76) / 2} ${Y.foot - 2} L${rig.cx} ${Y.foot} Z`}
        fill={p.clothDark}
        opacity={0.18 + 0.3 * Math.max(0, rig.s)}
      />
      {/* Bloques encadenados sobre la tela */}
      {alpha > 0.05 &&
        cols.map((col) =>
          [0, 1, 2].map((row) => {
            const bx = place(rig, col * 15, 16);
            const by = Y.chest + row * 16;
            const bw = proj(rig, 11, 4);
            return (
              <g key={`${col}-${row}`} opacity={alpha * (0.9 - row * 0.15)}>
                <rect x={bx - bw / 2} y={by} width={bw} height="9" rx="2" fill={p.shellDark} />
                <rect x={bx - bw / 2 + 1} y={by + 2} width={Math.max(1, bw - 2)} height="2" rx="1" fill={p.glow} opacity="0.9" />
              </g>
            );
          }),
        )}
      {alpha > 0.05 && (
        <path
          d={`M${place(rig, -15, 16)} ${Y.chest + 4} L${place(rig, 15, 16)} ${Y.chest + 4}
              M${place(rig, -15, 16)} ${Y.chest + 20} L${place(rig, 15, 16)} ${Y.chest + 20}`}
          stroke={p.glow}
          strokeWidth="1.2"
          opacity={alpha * 0.5}
        />
      )}
    </g>
  );
}

// ------------------------------------------------------------- INSTRUMENTOS

function grip(rig: PartProps["rig"]) {
  const lateral = -33;
  const forward = 12;
  return {
    x: place(rig, lateral, forward),
    y: Y.hip - 2,
    front: depthAt(rig, lateral, forward) < 0 ? 0.4 : 1,
    scale: 0.5 + 0.16 * Math.abs(rig.c),
  };
}

export function InstLlave({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <circle cx="0" cy="-14" r="13" fill="none" stroke={p.shellDark} strokeWidth="7" />
      <circle cx="0" cy="-14" r="13" fill="none" stroke={p.glow} strokeWidth="2.4" opacity="0.85" />
      <rect x="-3.5" y="-2" width="7" height="30" rx="2" fill={p.shellDark} />
      <rect x="-3.5" y="12" width="14" height="5" rx="2" fill={p.shellDark} />
      <rect x="-3.5" y="21" width="10" height="5" rx="2" fill={p.shellDark} />
      <circle cx="0" cy="-14" r="4" fill={p.glow} />
      <circle cx="0" cy="-14" r="9" fill={p.glow} opacity="0.16" />
    </g>
  );
}

export function InstHistoria({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <rect x="-20" y="-24" width="40" height="50" rx="4" fill={p.shellDark} />
      <rect x="-16" y="-20" width="32" height="42" rx="3" fill={p.glowDeep} />
      {/* Latido */}
      <path d="M-12 -2 L-6 -2 L-3 -10 L1 8 L5 -2 L12 -2" fill="none" stroke={p.glow} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-12" y="10" width="16" height="2.4" rx="1.2" fill={p.glow} opacity="0.6" />
      <rect x="-12" y="15" width="10" height="2.4" rx="1.2" fill={p.glow} opacity="0.4" />
      {/* Candado: es el dato más sensible */}
      <rect x="6" y="10" width="12" height="10" rx="2" fill={p.shell} />
      <path d="M9 10 L9 6 Q12 3 15 6 L15 10" fill="none" stroke={p.shell} strokeWidth="2" />
      <circle cx="12" cy="15" r="1.8" fill={p.glowDeep} />
    </g>
  );
}

export function InstRastreador({ p, rig }: PartProps) {
  const g = grip(rig);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} opacity={g.front}>
      <rect x="-5" y="-4" width="10" height="32" rx="4" fill={p.shellDark} />
      <circle cx="0" cy="-16" r="15" fill="none" stroke={p.shellDark} strokeWidth="5" />
      <circle cx="0" cy="-16" r="15" fill={p.glowDeep} opacity="0.55" />
      {/* Barrido de radar */}
      <g className="av-spin" style={{ transformOrigin: "0px -16px" }}>
        <path d="M0 -16 L0 -31 A15 15 0 0 1 13 -8 Z" fill={p.glow} opacity="0.4" />
      </g>
      <circle cx="0" cy="-16" r="3" fill={p.glow} />
      {/* Huellas detectadas */}
      <circle cx="-7" cy="-21" r="2" fill={p.glow} opacity="0.85" />
      <circle cx="6" cy="-11" r="1.6" fill={p.glow} opacity="0.6" />
    </g>
  );
}

// --------------------------------------------------------------- COMPAÑEROS

function orbit(rig: PartProps["rig"], offset: number, y: number) {
  const behind = Math.max(0, offset * rig.s) / Math.abs(offset || 1);
  return { x: place(rig, offset), y, scale: 1 - 0.28 * behind, opacity: 1 - 0.55 * behind };
}

export function CompGuardian({ p, rig }: PartProps) {
  const o = orbit(rig, 54, Y.shoulder - 4);
  return (
    <g opacity={o.opacity}>
      <g transform={`translate(${o.x} ${o.y}) scale(${o.scale})`}>
        {/* Escudo-firewall */}
        <path d="M0 -16 L15 -10 L15 4 Q15 16 0 22 Q-15 16 -15 4 L-15 -10 Z" fill={p.shellDark} />
        <path d="M0 -12 L11 -7.5 L11 3.5 Q11 12 0 17 Q-11 12 -11 3.5 L-11 -7.5 Z" fill={p.glowDeep} />
        <path d="M-7 0 L11 0 M-11 6 L7 6 M-5 -6 L11 -6" stroke={p.glow} strokeWidth="1.6" opacity="0.8" />
        <circle cx="0" cy="2" r="3.5" fill={p.glow} />
      </g>
    </g>
  );
}

export function CompOraculo({ p, rig }: PartProps) {
  const o = orbit(rig, 56, Y.shoulder - 14);
  return (
    <g opacity={o.opacity}>
      <g transform={`translate(${o.x} ${o.y}) scale(${o.scale})`}>
        {/* Núcleo inestable: propone y alucina */}
        <g className="av-spin">
          <path d="M0 -18 L16 0 L0 18 L-16 0 Z" fill="none" stroke={p.glow} strokeWidth="1.8" opacity="0.55" />
        </g>
        <g className="av-spin-rev">
          <path d="M0 -13 L12 0 L0 13 L-12 0 Z" fill="none" stroke={p.glow} strokeWidth="1.4" opacity="0.4" />
        </g>
        <circle cx="0" cy="0" r="7" fill={p.shellDark} />
        <circle cx="0" cy="0" r="4.5" fill={p.glow} className="av-pulse" style={{ transformOrigin: "0px 0px" }} />
        <circle cx="0" cy="0" r="12" fill={p.glow} opacity="0.14" />
        {/* Fragmentos generados */}
        {[
          [-19, -12],
          [20, -6],
          [14, 15],
        ].map(([fx, fy], i) => (
          <rect key={i} x={fx} y={fy} width="6" height="3" rx="1.5" fill={p.glow} opacity={0.7 - i * 0.15} />
        ))}
      </g>
    </g>
  );
}

// --------------------------------------------------------------------- AURAS

export function AuraCadena({ p, rig }: PartProps) {
  const r = proj(rig, 150, 130) / 2;
  return (
    <g className="av-spin-slow" style={{ transformOrigin: "120px 128px" }}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI * 2) / 8;
        const bx = 120 + Math.cos(a) * r;
        const by = 128 + Math.sin(a) * r * 0.42;
        return (
          <g key={i}>
            <rect x={bx - 7} y={by - 5} width="14" height="10" rx="2.5" fill="none" stroke={p.glow} strokeWidth="1.6" opacity="0.6" />
            <rect x={bx - 3} y={by - 1.5} width="6" height="3" rx="1.5" fill={p.glow} opacity="0.8" />
          </g>
        );
      })}
      <ellipse cx="120" cy="128" rx={r} ry={r * 0.42} fill="none" stroke={p.glow} strokeWidth="1" opacity="0.25" strokeDasharray="4 6" />
    </g>
  );
}

export function AuraFirma({ p, rig }: PartProps) {
  const r = proj(rig, 160, 140) / 2;
  return (
    <g>
      <circle cx="120" cy="128" r={r * 0.9} fill={p.glow} opacity="0.05" />
      <g className="av-spin" style={{ transformOrigin: "120px 128px" }}>
        {/* Rúbrica orbitando */}
        <path
          d={`M${120 - r} 128 q${r * 0.4} -26 ${r * 0.8} 0 q${r * 0.4} 26 ${r * 0.8} 0`}
          fill="none"
          stroke={p.glow}
          strokeWidth="2.2"
          opacity="0.65"
          strokeLinecap="round"
        />
        <circle cx={120 + r} cy="128" r="4" fill={p.glow} />
      </g>
      <g className="av-spin-rev" style={{ transformOrigin: "120px 128px" }}>
        <ellipse cx="120" cy="128" rx={r * 0.72} ry={r * 0.3} fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.35" />
      </g>
    </g>
  );
}

export function AuraConsenso({ p, rig }: PartProps) {
  const r = proj(rig, 180, 160) / 2;
  const nodes = Array.from({ length: 9 }, (_, i) => {
    const a = (i * Math.PI * 2) / 9;
    return [120 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.45] as const;
  });
  return (
    <g>
      <circle cx="120" cy="128" r={r * 0.95} fill={p.glow} opacity="0.06" />
      <g className="av-spin-slow" style={{ transformOrigin: "120px 128px" }}>
        {/* Malla de nodos que se ponen de acuerdo */}
        {nodes.map(([x1, y1], i) =>
          nodes.slice(i + 1).map(([x2, y2], j) => (
            <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.glow} strokeWidth="0.6" opacity="0.16" />
          )),
        )}
        {nodes.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3.6" fill={p.glow} opacity="0.9" />
            <circle cx={x} cy={y} r="8" fill={p.glow} opacity="0.14" />
          </g>
        ))}
      </g>
    </g>
  );
}

// ------------------------------------------------------------------- FONDOS

export function FondoLaboratorio({ p }: PartProps) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#0b1018" />
      {/* Cápsulas de cultivo */}
      {[
        [40, 70],
        [200, 70],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 15} y={y} width="30" height="96" rx="15" fill="#141a26" />
          <rect x={x - 11} y={y + 8} width="22" height="80" rx="11" fill={p.glow} opacity="0.09" />
          <ellipse cx={x} cy={y + 60} rx="8" ry="12" fill={p.glow} opacity="0.22" />
        </g>
      ))}
      {/* Hélice de fondo */}
      {[0, 1].map((k) => (
        <path
          key={k}
          d={`M96 46 Q${k ? 152 : 88} 96 120 146 Q${k ? 88 : 152} 196 96 232`}
          fill="none"
          stroke={p.glow}
          strokeWidth="1.1"
          opacity="0.14"
        />
      ))}
      <path d="M14 186 L226 186" stroke="#1c2231" strokeWidth="3" />
    </g>
  );
}

export function FondoForense({ p }: PartProps) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#0a0e17" />
      {/* Tablero de evidencia */}
      <rect x="26" y="44" width="188" height="112" rx="4" fill="#131824" />
      {[
        [46, 62, 34, 26],
        [96, 58, 40, 30],
        [156, 66, 34, 24],
        [62, 108, 38, 28],
        [126, 112, 44, 26],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="2" fill="#1b2130" />
          <rect x={x + 3} y={y + 4} width={w - 6} height="2" rx="1" fill={p.glow} opacity="0.35" />
          <rect x={x + 3} y={y + 9} width={(w - 6) * 0.7} height="2" rx="1" fill={p.glow} opacity="0.2" />
        </g>
      ))}
      {/* Hilos que conectan la evidencia */}
      <path d="M63 75 L116 73 M136 73 L173 78 M81 122 L148 125 M116 88 L81 108" stroke={p.glow} strokeWidth="1" opacity="0.3" />
      <path d="M20 190 L220 190" stroke="#1c2231" strokeWidth="3" />
    </g>
  );
}

export function FondoMercado({ p }: PartProps) {
  const bars = [58, 92, 74, 118, 96, 140, 112, 168, 132, 150];
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#080d16" />
      {/* Velas del mercado */}
      {bars.map((h, i) => {
        const x = 20 + i * 21;
        const top = 200 - h;
        const up = i % 2 === 0;
        return (
          <g key={i} opacity="0.5">
            <rect x={x} y={top} width="11" height={h - 30} rx="2" fill={up ? p.glow : p.glowDeep} opacity={up ? 0.4 : 0.6} />
            <line x1={x + 5.5} y1={top - 10} x2={x + 5.5} y2={top + h - 22} stroke={up ? p.glow : p.glowDeep} strokeWidth="1.4" opacity="0.5" />
          </g>
        );
      })}
      {/* Línea de tendencia */}
      <path d="M14 168 L58 140 L96 152 L134 108 L176 120 L226 78" fill="none" stroke={p.glow} strokeWidth="1.8" opacity="0.55" />
      <circle cx="226" cy="78" r="4" fill={p.glow} />
      <path d="M10 196 L230 196" stroke="#161b28" strokeWidth="3" />
    </g>
  );
}

export function FondoPanteon({ p }: PartProps) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#080b14" />
      {/* Cúpula con óculo */}
      <path d="M120 6 L214 82 L214 196 L26 196 L26 82 Z" fill="#11162170" />
      <path d="M120 6 L214 82 L26 82 Z" fill="#161c2a" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1="120" y1="6" x2={26 + i * 23.5} y2="82" stroke={p.glow} strokeWidth="0.8" opacity="0.22" />
      ))}
      <circle cx="120" cy="40" r="16" fill={p.glow} opacity="0.16" />
      <circle cx="120" cy="40" r="9" fill={p.glow} opacity="0.5" />
      {/* Columnata profunda */}
      {[38, 66, 174, 202].map((x, i) => (
        <g key={i}>
          <rect x={x - 9} y="90" width="18" height="106" fill="#1a2130" />
          <rect x={x - 12} y="86" width="24" height="7" rx="2" fill="#212838" />
        </g>
      ))}
      {/* Bustos de la doctrina, apenas sugeridos */}
      {[92, 148].map((x, i) => (
        <g key={i} opacity="0.5">
          <circle cx={x} cy="150" r="8" fill="#212838" />
          <path d={`M${x - 11} 178 Q${x} 158 ${x + 11} 178 Z`} fill="#212838" />
        </g>
      ))}
      <path d="M26 196 L214 196" stroke={p.glow} strokeWidth="1.6" opacity="0.45" />
    </g>
  );
}

export const TEMATICOS = {
  visor: {
    "visor-forense": VisorForense,
    "visor-bioetica": VisorBioetica,
  },
  toga: {
    "toga-bioderecho": TogaBioderecho,
    "toga-cripto": TogaCripto,
  },
  instrumento: {
    "inst-llave": InstLlave,
    "inst-historia": InstHistoria,
    "inst-rastreador": InstRastreador,
  },
  companion: {
    "comp-guardian": CompGuardian,
    "comp-oraculo": CompOraculo,
  },
  aura: {
    "aura-cadena": AuraCadena,
    "aura-firma": AuraFirma,
    "aura-consenso": AuraConsenso,
  },
  fondo: {
    "fondo-laboratorio": FondoLaboratorio,
    "fondo-forense": FondoForense,
    "fondo-mercado": FondoMercado,
    "fondo-panteon": FondoPanteon,
  },
} as const;
