import type { Palette } from "../palette";

/**
 * Compañeros: van a la derecha del busto. Se ganan con RACHA, no con XP — son
 * el premio a volver, así que conviene que se noten.
 */

function Dron({ p, x, y, scale = 1 }: { p: Palette; x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="16" rx="14" ry="4" fill={p.glow} opacity="0.14" />
      <path d="M-14 0 Q-14 -11 0 -11 Q14 -11 14 0 Q14 9 0 9 Q-14 9 -14 0 Z" fill={p.shellDark} />
      <path d="M-11 -2 Q-11 -8 0 -8 Q11 -8 11 -2 Z" fill={p.shell} opacity="0.8" />
      <circle cx="0" cy="1" r="5" fill={p.glowDeep} />
      <circle cx="0" cy="1" r="3" fill={p.glow} />
      {/* Rotores */}
      <path d="M-14 -4 L-21 -8 M14 -4 L21 -8" stroke={p.shellDark} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="-22" cy="-9" rx="7" ry="2" fill={p.glow} opacity="0.5" />
      <ellipse cx="22" cy="-9" rx="7" ry="2" fill={p.glow} opacity="0.5" />
    </g>
  );
}

export function CompDron({ p }: { p: Palette }) {
  return <Dron p={p} x={196} y={110} />;
}

export function CompAsesor({ p }: { p: Palette }) {
  return (
    <g>
      <Dron p={p} x={196} y={104} scale={1.15} />
      {/* Panel de sugerencias proyectado */}
      <path d="M172 130 L220 130 L216 158 L176 158 Z" fill={p.glowDeep} opacity="0.5" />
      <path d="M172 130 L220 130 L216 158 L176 158 Z" fill="none" stroke={p.glow} strokeWidth="1.5" opacity="0.8" />
      <path d="M180 138 L208 138 M180 145 L204 145 M180 152 L198 152" stroke={p.glow} strokeWidth="1.8" opacity="0.9" strokeLinecap="round" />
    </g>
  );
}

export function CompEnjambre({ p }: { p: Palette }) {
  return (
    <g>
      <Dron p={p} x={200} y={96} scale={0.9} />
      <Dron p={p} x={214} y={136} scale={0.7} />
      <Dron p={p} x={182} y={148} scale={0.6} />
      {/* Enlace entre unidades */}
      <path d="M200 100 L214 136 L182 148 Z" fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.35" strokeDasharray="3 4" />
    </g>
  );
}

export function CompTestigo({ p }: { p: Palette }) {
  return (
    <g>
      {/* Esfera de registro: no vuela, orbita */}
      <circle cx="198" cy="118" r="10" fill="none" stroke={p.glow} strokeWidth="1.5" opacity="0.4" />
      <circle cx="198" cy="118" r="18" fill="none" stroke={p.glow} strokeWidth="1" opacity="0.22" />
      <circle cx="198" cy="118" r="7" fill={p.shellDark} />
      <circle cx="198" cy="118" r="4" fill={p.glow} />
      <circle cx="198" cy="118" r="9" fill={p.glow} opacity="0.25" />
      {/* Marca de tiempo flotante */}
      <rect x="176" y="142" width="44" height="16" rx="4" fill={p.glowDeep} opacity="0.6" />
      <rect x="176" y="142" width="44" height="16" rx="4" fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.7" />
      <text x="198" y="154" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill={p.glow}>
        23:41
      </text>
      {/* Órbitas menores */}
      <circle cx="212" cy="104" r="2.5" fill={p.glow} opacity="0.8" />
      <circle cx="184" cy="132" r="2" fill={p.glow} opacity="0.6" />
    </g>
  );
}

export const COMPANIONS = {
  "comp-dron": CompDron,
  "comp-asesor": CompAsesor,
  "comp-enjambre": CompEnjambre,
  "comp-testigo": CompTestigo,
} as const;
