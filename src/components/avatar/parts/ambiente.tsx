import type { Palette } from "../palette";

/**
 * Auras (detrás del busto, delante del fondo) y fondos (el escenario).
 * Las animaciones son CSS puro y respetan prefers-reduced-motion desde globals.
 */

// ----------------------------------------------------------------- AURAS

export function AuraPulso({ p }: { p: Palette }) {
  return (
    <g className="av-pulse">
      <circle cx="120" cy="130" r="72" fill="none" stroke={p.glow} strokeWidth="1.5" opacity="0.35" />
      <circle cx="120" cy="130" r="86" fill="none" stroke={p.glow} strokeWidth="1" opacity="0.18" />
    </g>
  );
}

export function AuraCampo({ p }: { p: Palette }) {
  return (
    <g>
      <g className="av-spin-slow" style={{ transformOrigin: "120px 130px" }}>
        <path
          d="M120 46 L188 88 L188 172 L120 214 L52 172 L52 88 Z"
          fill="none"
          stroke={p.glow}
          strokeWidth="1.6"
          opacity="0.42"
        />
        {[
          [120, 46],
          [188, 88],
          [188, 172],
          [120, 214],
          [52, 172],
          [52, 88],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3" fill={p.glow} opacity="0.75" />
        ))}
      </g>
      <circle cx="120" cy="130" r="94" fill={p.glow} opacity="0.05" />
    </g>
  );
}

export function AuraTormenta({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="130" r="96" fill={p.glow} opacity="0.07" />
      <g className="av-spin" style={{ transformOrigin: "120px 130px" }}>
        <ellipse cx="120" cy="130" rx="96" ry="34" fill="none" stroke={p.glow} strokeWidth="1.6" opacity="0.45" />
        <circle cx="216" cy="130" r="4" fill={p.glow} />
        <circle cx="24" cy="130" r="3" fill={p.glow} opacity="0.8" />
      </g>
      <g className="av-spin-rev" style={{ transformOrigin: "120px 130px" }}>
        <ellipse
          cx="120"
          cy="130"
          rx="96"
          ry="34"
          fill="none"
          stroke={p.glow}
          strokeWidth="1.4"
          opacity="0.35"
          transform="rotate(58 120 130)"
        />
        <circle cx="171" cy="49" r="3.5" fill={p.glow} opacity="0.9" />
      </g>
      <g className="av-spin-slow" style={{ transformOrigin: "120px 130px" }}>
        <ellipse
          cx="120"
          cy="130"
          rx="96"
          ry="34"
          fill="none"
          stroke={p.glow}
          strokeWidth="1.2"
          opacity="0.28"
          transform="rotate(-58 120 130)"
        />
      </g>
    </g>
  );
}

export function AuraCatedra({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="130" r="100" fill={p.glow} opacity="0.09" />
      <circle cx="120" cy="130" r="76" fill={p.glow} opacity="0.07" />
      {/* Rayos radiales */}
      <g className="av-spin-slow" style={{ transformOrigin: "120px 130px" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI * 2) / 12;
          const x1 = 120 + Math.cos(a) * 66;
          const y1 = 130 + Math.sin(a) * 66;
          const x2 = 120 + Math.cos(a) * (i % 2 === 0 ? 102 : 84);
          const y2 = 130 + Math.sin(a) * (i % 2 === 0 ? 102 : 84);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.glow} strokeWidth={i % 2 === 0 ? 2.2 : 1.2} opacity="0.5" strokeLinecap="round" />
          );
        })}
      </g>
      <g className="av-pulse">
        <circle cx="120" cy="130" r="62" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.5" />
      </g>
    </g>
  );
}

export const AURAS = {
  "aura-pulso": AuraPulso,
  "aura-campo": AuraCampo,
  "aura-tormenta": AuraTormenta,
  "aura-catedra": AuraCatedra,
} as const;

// ----------------------------------------------------------------- FONDOS

export function FondoAula({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#12151f" />
      {/* Pizarrón y bancos, muy sugeridos */}
      <rect x="34" y="62" width="94" height="52" rx="3" fill="#1b1f2c" />
      <path d="M44 76 L88 76 M44 88 L110 88 M44 100 L74 100" stroke="#2a3040" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 176 L232 176" stroke="#232838" strokeWidth="3" />
      <path d="M20 196 L220 196" stroke="#1e2331" strokeWidth="3" />
      <circle cx="186" cy="70" r="26" fill={p.glow} opacity="0.05" />
    </g>
  );
}

export function FondoEstrado({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#101420" />
      {/* Columnas */}
      {[36, 68, 172, 204].map((x, i) => (
        <g key={i}>
          <rect x={x - 9} y="40" width="18" height="140" fill="#191d2a" />
          <rect x={x - 12} y="36" width="24" height="8" fill="#20253400" stroke="#232838" strokeWidth="0" />
          <rect x={x - 12} y="36" width="24" height="8" fill="#212636" />
        </g>
      ))}
      {/* Arco */}
      <path d="M78 60 Q120 26 162 60" fill="none" stroke="#232838" strokeWidth="6" />
      {/* Estrado elevado */}
      <path d="M52 182 L188 182 L200 214 L40 214 Z" fill="#191d2a" />
      <path d="M52 182 L188 182" stroke={p.glow} strokeWidth="1.5" opacity="0.4" />
      <circle cx="120" cy="72" r="30" fill={p.glow} opacity="0.06" />
    </g>
  );
}

export function FondoServidor({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#0c111c" />
      {/* Racks a los costados */}
      {[
        [14, 56],
        [200, 56],
      ].map(([x, y], r) => (
        <g key={r}>
          <rect x={x} y={y} width="26" height="132" rx="3" fill="#161b28" />
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i}>
              <rect x={x + 4} y={y + 8 + i * 16} width="18" height="9" rx="2" fill="#1e2431" />
              <circle cx={x + 8} cy={y + 12.5 + i * 16} r="1.8" fill={p.glow} opacity={i % 3 === 0 ? 0.9 : 0.3} />
            </g>
          ))}
        </g>
      ))}
      {/* Trazas de datos */}
      <path d="M46 88 L74 88 L74 60 L100 60" fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.3" />
      <path d="M194 152 L166 152 L166 182 L138 182" fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.3" />
      <path d="M46 168 L70 168 L70 196" fill="none" stroke={p.glow} strokeWidth="1.2" opacity="0.22" />
      <circle cx="120" cy="120" r="70" fill={p.glow} opacity="0.05" />
    </g>
  );
}

export function FondoCorte({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#0b0f1a" />
      {/* Cúpula geométrica */}
      <path d="M120 14 L206 78 L206 190 L34 190 L34 78 Z" fill="#141926" opacity="0.9" />
      <path d="M120 14 L206 78 L34 78 Z" fill="#191f2e" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1="120" y1="14" x2={34 + i * 28.7} y2="78" stroke={p.glow} strokeWidth="0.9" opacity="0.25" />
      ))}
      {/* Columnata */}
      {[52, 86, 154, 188].map((x, i) => (
        <rect key={i} x={x - 8} y="86" width="16" height="104" fill="#1c2231" />
      ))}
      {/* Emblema superior */}
      <circle cx="120" cy="52" r="15" fill="none" stroke={p.glow} strokeWidth="2" opacity="0.75" />
      <path d="M120 44 L127 52 L120 60 L113 52 Z" fill={p.glow} opacity="0.9" />
      <circle cx="120" cy="52" r="26" fill={p.glow} opacity="0.09" />
      <path d="M34 190 L206 190" stroke={p.glow} strokeWidth="1.5" opacity="0.4" />
    </g>
  );
}

export function FondoCiber({ p }: { p: Palette }) {
  return (
    <g>
      <circle cx="120" cy="120" r="118" fill="#0a0d16" />
      {/* Grilla en perspectiva */}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`h${i}`} x1="4" y1={140 + i * 10} x2="236" y2={140 + i * 10} stroke={p.glow} strokeWidth="0.7" opacity={0.06 + i * 0.025} />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <line key={`v${i}`} x1={120 + (i - 5) * 14} y1="140" x2={120 + (i - 5) * 46} y2="238" stroke={p.glow} strokeWidth="0.7" opacity="0.14" />
      ))}
      {/* Lluvia de código */}
      {[
        [40, 40, 46],
        [66, 26, 34],
        [176, 34, 40],
        [202, 48, 28],
        [150, 22, 24],
      ].map(([x, y, h], i) => (
        <rect key={i} x={x} y={y} width="2.5" height={h} rx="1.2" fill={p.glow} opacity={0.18 + (i % 3) * 0.12} />
      ))}
      <circle cx="120" cy="118" r="82" fill={p.glow} opacity="0.05" />
    </g>
  );
}

export const FONDOS = {
  "fondo-aula": FondoAula,
  "fondo-estrado": FondoEstrado,
  "fondo-servidor": FondoServidor,
  "fondo-corte": FondoCorte,
  "fondo-ciber": FondoCiber,
} as const;
