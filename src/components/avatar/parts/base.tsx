import type { Palette } from "../palette";
import type { ChassisId } from "../palette";

/**
 * Cuerpo del operador: torso, cuello y chasis de la cabeza.
 * Todo en un lienzo de 240×240, con el busto centrado en x=120.
 */

export function Torso({ p }: { p: Palette }) {
  return (
    <g>
      {/* Hombros y pecho: trapecio ancho con hombreras de chasis */}
      <path d="M120 128 L172 150 Q186 157 188 172 L192 214 L48 214 L52 172 Q54 157 68 150 Z" fill={p.cloth} />
      <path d="M120 128 L172 150 Q186 157 188 172 L190 190 L120 190 Z" fill={p.clothDark} opacity="0.55" />
      {/* Hombreras */}
      <path d="M62 152 Q78 142 92 150 L86 176 Q70 172 58 178 Z" fill={p.shellDark} />
      <path d="M178 152 Q162 142 148 150 L154 176 Q170 172 182 178 Z" fill={p.shellDark} />
      <path d="M64 154 Q78 146 90 153 L86 168 Q72 166 62 170 Z" fill={p.shell} opacity="0.75" />
      <path d="M176 154 Q162 146 150 153 L154 168 Q168 166 178 170 Z" fill={p.shell} opacity="0.75" />
      {/* Cuello */}
      <path d="M106 116 L134 116 L136 136 Q120 144 104 136 Z" fill={p.shellDark} />
      {/* Placa pectoral con la luz del operador */}
      <path d="M120 146 L138 156 L134 178 L106 178 L102 156 Z" fill={p.shellDark} />
      <path d="M120 152 L131 158 L128 173 L112 173 L109 158 Z" fill={p.glowDeep} />
      <circle cx="120" cy="164" r="5" fill={p.glow} />
      <circle cx="120" cy="164" r="9" fill={p.glow} opacity="0.28" />
    </g>
  );
}

export function Head({ p, chassis }: { p: Palette; chassis: ChassisId }) {
  if (chassis === "angular") {
    return (
      <g>
        <path d="M120 48 L152 62 L156 96 L140 120 L100 120 L84 96 L88 62 Z" fill={p.shell} />
        <path d="M120 48 L152 62 L156 96 L140 120 L120 120 Z" fill={p.shellDark} opacity="0.35" />
        <path d="M120 48 L152 62 L150 70 L90 70 L88 62 Z" fill={p.shellLight} opacity="0.5" />
        {/* Respiradero lateral */}
        <path d="M86 84 L94 84 L94 100 L88 100 Z" fill={p.shellDark} />
        <path d="M154 84 L146 84 L146 100 L152 100 Z" fill={p.shellDark} />
      </g>
    );
  }

  if (chassis === "encapuchado") {
    return (
      <g>
        {/* Capucha técnica por detrás del chasis */}
        <path d="M120 34 Q166 38 172 92 Q174 124 160 136 L150 118 Q158 96 154 78 Q146 54 120 52 Q94 54 86 78 Q82 96 90 118 L80 136 Q66 124 68 92 Q74 38 120 34 Z" fill={p.clothDark} />
        <path d="M120 34 Q166 38 172 92 Q174 110 168 122 Q166 96 158 74 Q144 50 120 50 Z" fill={p.cloth} opacity="0.7" />
        <ellipse cx="120" cy="88" rx="33" ry="36" fill={p.shell} />
        <path d="M120 52 Q153 52 153 88 Q153 124 120 124 Z" fill={p.shellDark} opacity="0.3" />
      </g>
    );
  }

  // redondo
  return (
    <g>
      <ellipse cx="120" cy="88" rx="34" ry="37" fill={p.shell} />
      <path d="M120 51 Q154 51 154 88 Q154 125 120 125 Z" fill={p.shellDark} opacity="0.32" />
      <path d="M120 51 Q146 51 152 72 Q140 62 120 62 Q100 62 88 72 Q94 51 120 51 Z" fill={p.shellLight} opacity="0.55" />
      {/* Puerto auricular */}
      <circle cx="88" cy="94" r="6" fill={p.shellDark} />
      <circle cx="152" cy="94" r="6" fill={p.shellDark} />
      <circle cx="152" cy="94" r="2.5" fill={p.glow} opacity="0.8" />
    </g>
  );
}
