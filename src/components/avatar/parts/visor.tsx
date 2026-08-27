import type { Palette } from "../palette";

/**
 * Visores: el módulo de análisis. Ocupa el lugar de la cara, así que es la pieza
 * que más define al operador — cada nivel se nota de lejos.
 */

export function VisorBasico({ p }: { p: Palette }) {
  return (
    <g>
      <rect x="92" y="80" width="56" height="20" rx="10" fill={p.shellDark} />
      <rect x="96" y="84" width="48" height="12" rx="6" fill={p.glowDeep} />
      <rect x="100" y="87" width="16" height="6" rx="3" fill={p.glow} />
      <rect x="124" y="87" width="16" height="6" rx="3" fill={p.glow} />
    </g>
  );
}

export function VisorLente({ p }: { p: Palette }) {
  return (
    <g>
      <rect x="88" y="78" width="64" height="24" rx="12" fill={p.shellDark} />
      <rect x="92" y="82" width="56" height="16" rx="8" fill={p.glowDeep} />
      <path d="M96 90 L118 90 L114 96 L96 96 Z" fill={p.glow} />
      <path d="M144 90 L122 90 L126 96 L144 96 Z" fill={p.glow} />
      {/* Lente de aumento sobre el ojo derecho */}
      <circle cx="140" cy="90" r="13" fill="none" stroke={p.shellLight} strokeWidth="2.5" />
      <circle cx="140" cy="90" r="13" fill={p.glow} opacity="0.18" />
      <path d="M150 100 L158 110" stroke={p.shellDark} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export function VisorTactico({ p }: { p: Palette }) {
  return (
    <g>
      {/* Banda envolvente */}
      <path d="M84 76 Q120 68 156 76 L158 100 Q120 110 82 100 Z" fill={p.shellDark} />
      <path d="M88 80 Q120 73 152 80 L153 97 Q120 105 87 97 Z" fill={p.glowDeep} />
      <path d="M92 86 L116 84 L114 94 L92 93 Z" fill={p.glow} />
      <path d="M148 86 L124 84 L126 94 L148 93 Z" fill={p.glow} />
      {/* Antena de lectura lateral */}
      <path d="M156 78 L170 66 L174 70 L160 84 Z" fill={p.shell} />
      <circle cx="172" cy="68" r="4" fill={p.glow} />
      <circle cx="172" cy="68" r="8" fill={p.glow} opacity="0.25" />
      {/* Marcas de HUD */}
      <path d="M96 100 L100 106 M144 100 L140 106" stroke={p.glow} strokeWidth="1.5" opacity="0.7" />
    </g>
  );
}

export function VisorCorona({ p }: { p: Palette }) {
  return (
    <g>
      {/* Anillo de procesamiento por encima del chasis */}
      <ellipse cx="120" cy="52" rx="40" ry="11" fill="none" stroke={p.glow} strokeWidth="2.5" opacity="0.85" />
      <ellipse cx="120" cy="52" rx="40" ry="11" fill="none" stroke={p.glow} strokeWidth="6" opacity="0.16" />
      {[
        [82, 52],
        [104, 45],
        [136, 45],
        [158, 52],
        [120, 60],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.2" fill={p.glow} />
      ))}
      {/* Visor pleno */}
      <path d="M82 76 Q120 66 158 76 L160 102 Q120 113 80 102 Z" fill={p.shellDark} />
      <path d="M86 80 Q120 71 154 80 L155 99 Q120 108 85 99 Z" fill={p.glowDeep} />
      <path d="M90 88 Q120 82 150 88 L150 94 Q120 100 90 94 Z" fill={p.glow} opacity="0.9" />
      <path d="M98 84 L108 83 L107 97 L97 96 Z" fill={p.glow} />
      <path d="M142 84 L132 83 L133 97 L143 96 Z" fill={p.glow} />
    </g>
  );
}

export function VisorMagistral({ p }: { p: Palette }) {
  return (
    <g>
      {/* Diadema de laurel geométrico: la referencia clásica, en clave técnica */}
      <path d="M120 44 L128 36 L140 34 L150 40 L156 52" fill="none" stroke={p.glow} strokeWidth="3" strokeLinecap="round" />
      <path d="M120 44 L112 36 L100 34 L90 40 L84 52" fill="none" stroke={p.glow} strokeWidth="3" strokeLinecap="round" />
      {[
        [131, 35],
        [143, 34],
        [152, 42],
        [109, 35],
        [97, 34],
        [88, 42],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="4" fill={p.glow} />
          <circle cx={cx} cy={cy} r="8" fill={p.glow} opacity="0.2" />
        </g>
      ))}
      <path d="M120 40 L126 46 L120 52 L114 46 Z" fill={p.shellLight} />

      <path d="M80 74 Q120 63 160 74 L162 104 Q120 116 78 104 Z" fill={p.shellDark} />
      <path d="M84 78 Q120 68 156 78 L157 101 Q120 111 83 101 Z" fill={p.glowDeep} />
      <path d="M88 86 Q120 79 152 86 L152 96 Q120 103 88 96 Z" fill={p.glow} />
      <path d="M96 82 L106 81 L105 99 L95 98 Z" fill={p.shellLight} opacity="0.9" />
      <path d="M144 82 L134 81 L135 99 L145 98 Z" fill={p.shellLight} opacity="0.9" />
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
