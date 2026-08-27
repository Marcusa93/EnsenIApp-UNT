import type { Palette } from "../palette";

/**
 * Togas: van por encima del torso base. Cada una agrega solapas, ribetes y, en
 * las de mayor rango, luz propia sobre la tela.
 */

export function TogaCursante({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M120 132 L146 148 L138 214 L102 214 L94 148 Z" fill={p.cloth} />
      <path d="M120 132 L146 148 L142 214 L120 214 Z" fill={p.clothDark} opacity="0.5" />
      <path d="M104 142 L120 156 L136 142 L133 214 L107 214 Z" fill={p.clothDark} />
    </g>
  );
}

export function TogaReforzada({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M120 130 L152 148 L144 214 L96 214 L88 148 Z" fill={p.cloth} />
      <path d="M120 130 L152 148 L148 214 L120 214 Z" fill={p.clothDark} opacity="0.5" />
      {/* Solapas con costura técnica */}
      <path d="M98 140 L120 158 L142 140 L138 214 L102 214 Z" fill={p.clothDark} />
      <path d="M104 148 L120 162 L136 148" fill="none" stroke={p.shellDark} strokeWidth="2" />
      <path d="M96 176 L144 176 M96 192 L144 192" stroke={p.shellDark} strokeWidth="1.5" opacity="0.6" />
    </g>
  );
}

export function TogaFibra({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M120 128 L154 148 L146 214 L94 214 L86 148 Z" fill={p.cloth} />
      <path d="M120 128 L154 148 L150 214 L120 214 Z" fill={p.clothDark} opacity="0.5" />
      <path d="M96 138 L120 158 L144 138 L140 214 L100 214 Z" fill={p.clothDark} />
      {/* Ribetes de fibra: la luz corre por el borde de la solapa */}
      <path d="M96 138 L120 158 L144 138" fill="none" stroke={p.glow} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M104 168 L104 214 M136 168 L136 214" stroke={p.glow} strokeWidth="2" opacity="0.75" />
      <circle cx="104" cy="168" r="3" fill={p.glow} />
      <circle cx="136" cy="168" r="3" fill={p.glow} />
    </g>
  );
}

export function TogaProcesal({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M120 126 L158 148 L150 214 L90 214 L82 148 Z" fill={p.cloth} />
      <path d="M120 126 L158 148 L154 214 L120 214 Z" fill={p.clothDark} opacity="0.55" />
      {/* Placas de blindaje sobre la tela */}
      <path d="M92 152 L112 160 L110 190 L90 182 Z" fill={p.shellDark} />
      <path d="M148 152 L128 160 L130 190 L150 182 Z" fill={p.shellDark} />
      <path d="M94 156 L110 163 L109 178 L93 172 Z" fill={p.shell} opacity="0.6" />
      <path d="M146 156 L130 163 L131 178 L147 172 Z" fill={p.shell} opacity="0.6" />
      <path d="M98 140 L120 160 L142 140 L138 214 L102 214 Z" fill={p.clothDark} />
      <path d="M98 140 L120 160 L142 140" fill="none" stroke={p.glow} strokeWidth="3" strokeLinecap="round" />
      <path d="M120 168 L128 180 L120 214 L112 180 Z" fill={p.glowDeep} />
      <path d="M120 174 L124 181 L120 200 L116 181 Z" fill={p.glow} opacity="0.85" />
    </g>
  );
}

export function TogaCorte({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M120 124 L162 148 L154 214 L86 214 L78 148 Z" fill={p.cloth} />
      <path d="M120 124 L162 148 L158 214 L120 214 Z" fill={p.clothDark} opacity="0.55" />
      {/* Muceta con hombros elevados */}
      <path d="M78 148 Q120 128 162 148 L158 168 Q120 150 82 168 Z" fill={p.clothDark} />
      <path d="M78 148 Q120 128 162 148" fill="none" stroke={p.glow} strokeWidth="2.5" opacity="0.9" />
      {/* Solapas doradas por la luz del operador */}
      <path d="M96 150 L120 172 L144 150 L140 214 L100 214 Z" fill={p.clothDark} />
      <path d="M96 150 L120 172 L144 150" fill="none" stroke={p.glow} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M106 178 L106 214 M134 178 L134 214" stroke={p.glow} strokeWidth="2.5" />
      {/* Emblema de la Corte */}
      <path d="M120 182 L128 190 L120 200 L112 190 Z" fill={p.glow} />
      <circle cx="120" cy="190" r="14" fill="none" stroke={p.glow} strokeWidth="1.5" opacity="0.55" />
      <circle cx="120" cy="190" r="20" fill={p.glow} opacity="0.1" />
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
