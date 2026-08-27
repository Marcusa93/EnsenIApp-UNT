import type { Palette } from "../palette";

/**
 * Instrumentos de litigio: flotan a la izquierda del busto, como sostenidos por
 * el operador. Nunca son armas — son las herramientas con las que se litiga.
 */

export function InstCodice({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M28 150 L58 142 L58 190 L28 198 Z" fill={p.shellDark} />
      <path d="M58 142 L64 146 L64 194 L58 190 Z" fill={p.shell} />
      <path d="M33 156 L53 151 M33 165 L53 160 M33 174 L48 170" stroke={p.glow} strokeWidth="2" opacity="0.75" strokeLinecap="round" />
      <circle cx="46" cy="186" r="3" fill={p.glow} />
    </g>
  );
}

export function InstMazo({ p }: { p: Palette }) {
  return (
    <g>
      {/* Mango */}
      <path d="M40 196 L62 156" stroke={p.shellDark} strokeWidth="7" strokeLinecap="round" />
      <path d="M40 196 L62 156" stroke={p.shell} strokeWidth="3" strokeLinecap="round" />
      {/* Cabeza del mazo */}
      <g transform="rotate(-28 62 150)">
        <rect x="44" y="138" width="36" height="24" rx="5" fill={p.shellDark} />
        <rect x="47" y="141" width="30" height="18" rx="3" fill={p.shell} />
        <rect x="44" y="146" width="36" height="8" fill={p.glow} opacity="0.75" />
      </g>
      {/* Onda de impacto holográfica */}
      <path d="M30 176 Q40 172 48 176" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.55" strokeLinecap="round" />
      <path d="M26 184 Q40 178 52 184" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.3" strokeLinecap="round" />
    </g>
  );
}

export function InstBalanza({ p }: { p: Palette }) {
  return (
    <g>
      {/* Fiel y brazo */}
      <path d="M46 200 L46 146" stroke={p.shellDark} strokeWidth="5" strokeLinecap="round" />
      <path d="M22 150 L70 150" stroke={p.shellDark} strokeWidth="4" strokeLinecap="round" />
      <circle cx="46" cy="144" r="5" fill={p.glow} />
      <circle cx="46" cy="144" r="10" fill={p.glow} opacity="0.22" />
      {/* Platillos, uno más bajo: el equilibrio se está calculando */}
      <path d="M22 150 L22 164" stroke={p.shell} strokeWidth="2" />
      <path d="M70 150 L70 172" stroke={p.shell} strokeWidth="2" />
      <path d="M12 164 Q22 176 32 164 Z" fill={p.shellDark} />
      <path d="M60 172 Q70 184 80 172 Z" fill={p.shellDark} />
      <path d="M14 164 Q22 173 30 164" fill={p.glow} opacity="0.5" />
      <path d="M62 172 Q70 181 78 172" fill={p.glow} opacity="0.5" />
      <path d="M46 196 L36 206 L56 206 Z" fill={p.shellDark} />
    </g>
  );
}

export function InstSello({ p }: { p: Palette }) {
  return (
    <g>
      {/* Cuerpo del sello */}
      <path d="M38 152 L58 152 L62 172 L34 172 Z" fill={p.shellDark} />
      <rect x="42" y="134" width="12" height="20" rx="5" fill={p.shell} />
      <circle cx="48" cy="132" r="8" fill={p.shellDark} />
      <circle cx="48" cy="132" r="4" fill={p.glow} />
      {/* Base y marca proyectada */}
      <rect x="30" y="172" width="36" height="8" rx="3" fill={p.shell} />
      <ellipse cx="48" cy="196" rx="26" ry="9" fill={p.glow} opacity="0.16" />
      <ellipse cx="48" cy="196" rx="17" ry="6" fill="none" stroke={p.glow} strokeWidth="2" />
      <path d="M42 196 L46 200 L55 192" fill="none" stroke={p.glow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function InstMagno({ p }: { p: Palette }) {
  return (
    <g>
      {/* Códice abierto, flotando */}
      <path d="M14 158 Q46 148 46 158 L46 196 Q46 186 14 196 Z" fill={p.shellDark} />
      <path d="M78 158 Q46 148 46 158 L46 196 Q46 186 78 196 Z" fill={p.shell} />
      <path d="M46 156 L46 196" stroke={p.glowDeep} strokeWidth="2.5" />
      {/* Texto luminoso */}
      <path d="M22 164 L38 160 M22 172 L38 168 M22 180 L34 177" stroke={p.glow} strokeWidth="1.8" opacity="0.8" strokeLinecap="round" />
      <path d="M70 164 L54 160 M70 172 L54 168 M70 180 L58 177" stroke={p.glow} strokeWidth="1.8" opacity="0.8" strokeLinecap="round" />
      {/* Glifos que se elevan del códice */}
      {[
        [30, 140, 3.5],
        [46, 130, 4.5],
        [62, 140, 3.5],
        [46, 146, 2.5],
      ].map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={p.glow} opacity={0.9 - i * 0.12} />
          <circle cx={cx} cy={cy} r={Number(r) * 2.2} fill={p.glow} opacity="0.14" />
        </g>
      ))}
      <ellipse cx="46" cy="204" rx="30" ry="7" fill={p.glow} opacity="0.14" />
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
