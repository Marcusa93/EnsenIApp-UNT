import type { Palette } from "../palette";
import type { ChassisId } from "../palette";

/**
 * Cuerpo del operador: torso, cuello y chasis de la cabeza.
 * Lienzo de 240×240 con el busto centrado en x=120, recortado por un disco de r=118.
 *
 * Las proporciones importan más que el detalle: cuello sólido que une cabeza y
 * cuerpo, y hombreras que siguen la línea del hombro en vez de apoyarse encima
 * (si "flotan", el muñeco se lee como piezas sueltas y no como un personaje).
 */

export function Torso({ p }: { p: Palette }) {
  return (
    <g>
      {/* Cuello: pieza sólida de chasis, no un hueco oscuro */}
      <path d="M104 100 L136 100 L138 128 L102 128 Z" fill={p.shellDark} />
      <path d="M120 100 L136 100 L138 128 L120 128 Z" fill={p.shell} opacity="0.35" />
      {/* Sombra del casco sobre el cuello */}
      <path d="M104 100 L136 100 L136 108 L104 108 Z" fill="#000" opacity="0.28" />

      {/* Hombros y pecho: una sola curva continua desde el cuello */}
      <path d="M120 122 Q150 126 172 142 Q192 156 196 182 L200 216 L40 216 L44 182 Q48 156 68 142 Q90 126 120 122 Z" fill={p.cloth} />
      {/* Volumen: el lado derecho recibe menos luz */}
      <path d="M120 122 Q150 126 172 142 Q192 156 196 182 L200 216 L120 216 Z" fill={p.clothDark} opacity="0.45" />

      {/* Hombreras integradas: nacen del hombro y lo envuelven */}
      <path d="M68 142 Q90 126 120 122 L118 140 Q94 144 78 158 Q70 166 66 178 L58 176 Q60 154 68 142 Z" fill={p.shellDark} />
      <path d="M172 142 Q150 126 120 122 L122 140 Q146 144 162 158 Q170 166 174 178 L182 176 Q180 154 172 142 Z" fill={p.shellDark} />
      <path d="M70 146 Q90 132 118 128 L117 138 Q94 142 79 155 Q72 162 68 172 L63 171 Q65 156 70 146 Z" fill={p.shell} opacity="0.7" />
      <path d="M170 146 Q150 132 122 128 L123 138 Q146 142 161 155 Q168 162 172 172 L177 171 Q175 156 170 146 Z" fill={p.shell} opacity="0.7" />

      {/* Placa pectoral con la luz del operador */}
      <path d="M120 150 L140 162 L136 190 L104 190 L100 162 Z" fill={p.shellDark} />
      <path d="M120 157 L132 164 L129 183 L111 183 L108 164 Z" fill={p.glowDeep} />
      <circle cx="120" cy="171" r="5" fill={p.glow} />
      <circle cx="120" cy="171" r="10" fill={p.glow} opacity="0.25" />
    </g>
  );
}

export function Head({ p, chassis }: { p: Palette; chassis: ChassisId }) {
  if (chassis === "angular") {
    return (
      <g>
        <path d="M120 44 L150 58 L154 88 L140 108 L100 108 L86 88 L90 58 Z" fill={p.shell} />
        <path d="M120 44 L150 58 L154 88 L140 108 L120 108 Z" fill={p.shellDark} opacity="0.32" />
        <path d="M120 44 L150 58 L148 66 L92 66 L90 58 Z" fill={p.shellLight} opacity="0.5" />
        {/* Respiraderos laterales */}
        <path d="M88 78 L95 78 L95 92 L90 92 Z" fill={p.shellDark} />
        <path d="M152 78 L145 78 L145 92 L150 92 Z" fill={p.shellDark} />
        <circle cx="150" cy="85" r="2" fill={p.glow} opacity="0.75" />
      </g>
    );
  }

  if (chassis === "encapuchado") {
    return (
      <g>
        {/* Capucha técnica por detrás del chasis */}
        <path d="M120 30 Q164 34 170 84 Q172 112 158 124 L149 108 Q157 88 153 72 Q145 48 120 48 Q95 48 87 72 Q83 88 91 108 L82 124 Q68 112 70 84 Q76 34 120 30 Z" fill={p.clothDark} />
        <path d="M120 30 Q164 34 170 84 Q171 100 166 112 Q164 88 156 68 Q143 46 120 46 Z" fill={p.cloth} opacity="0.7" />
        <ellipse cx="120" cy="80" rx="29" ry="31" fill={p.shell} />
        <path d="M120 49 Q149 49 149 80 Q149 111 120 111 Z" fill={p.shellDark} opacity="0.3" />
      </g>
    );
  }

  // redondo
  return (
    <g>
      <ellipse cx="120" cy="79" rx="30" ry="33" fill={p.shell} />
      <path d="M120 46 Q150 46 150 79 Q150 112 120 112 Z" fill={p.shellDark} opacity="0.3" />
      <path d="M120 46 Q143 46 148 64 Q137 55 120 55 Q103 55 92 64 Q97 46 120 46 Z" fill={p.shellLight} opacity="0.55" />
      {/* Puertos auriculares */}
      <circle cx="92" cy="84" r="6" fill={p.shellDark} />
      <circle cx="148" cy="84" r="6" fill={p.shellDark} />
      <circle cx="148" cy="84" r="2.5" fill={p.glow} opacity="0.85" />
    </g>
  );
}
