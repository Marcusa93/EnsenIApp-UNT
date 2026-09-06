import { ImageResponse } from "next/og";

export const alt = "EnsenIA UNT — Derecho de las Nuevas Tecnologías y Bioderecho · Facultad de Derecho, UNT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CRIMSON = "#a81828";
const PAPER = "#f7f4ef";
const INK = "#1d1a1c";
const GRAY = "#63606a";
const VIOLET = "#6f4494";

/** Tarjeta social en la identidad de la Facultad: papel, carmesí y la trama de líneas del logo. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: PAPER,
          color: INK,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Regla de marca arriba */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: `linear-gradient(90deg, ${CRIMSON} 0%, ${CRIMSON} 60%, ${VIOLET} 100%)`,
          }}
        />
        {/* Trama de líneas (el retrato del logo) a la derecha */}
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 90,
            width: 300,
            height: 420,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {Array.from({ length: 36 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 2,
                width: `${100 - Math.abs(18 - i) * 3.2}%`,
                marginLeft: "auto",
                background: CRIMSON,
                opacity: 0.18 + (i % 4) * 0.05,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: CRIMSON,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
              <g stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round">
                <path d="M8 9.5h16" />
                <path d="M8 14.5h10" />
                <path d="M8 19.5h16" />
                <path d="M8 24.5h12" />
              </g>
              <circle cx="22.5" cy="14.5" r="2.3" fill="#4cc3ba" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, display: "flex" }}>
              Ensen<span style={{ color: CRIMSON }}>IA</span>
            </div>
            <div style={{ fontSize: 14, letterSpacing: 4, color: GRAY, textTransform: "uppercase", fontWeight: 700 }}>
              Facultad de Derecho y Ciencias Sociales · UNT
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 780 }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 22 }}>
            <div style={{ width: 8, background: CRIMSON, borderRadius: 4 }} />
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
              Derecho de las Nuevas Tecnologías y Bioderecho en el siglo XXI
            </div>
          </div>
          <div style={{ fontSize: 24, color: GRAY, lineHeight: 1.35 }}>
            Campus digital: clases grabadas procesadas con IA, placas interactivas, lenguaje simple y feedback personalizado.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {["Nuevas tecnologías", "Bioderecho", "IA generativa"].map((t) => (
              <div
                key={t}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1px solid ${CRIMSON}55`,
                  background: `${CRIMSON}12`,
                  color: CRIMSON,
                  fontSize: 15,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 15, color: GRAY, display: "flex", gap: 6 }}>
            Desarrollado por el Laboratorio de IA, Innovación y Transformación Digital{" "}
            <span style={{ color: VIOLET, fontWeight: 800 }}>DYNTEC</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
