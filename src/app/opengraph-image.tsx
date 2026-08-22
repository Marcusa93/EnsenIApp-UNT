import { ImageResponse } from "next/og";

export const alt = "EnsenIA UNT — Derecho de las Nuevas Tecnologías y Bioderecho";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          padding: 72,
          background: "linear-gradient(135deg, #070812 0%, #0e1020 60%, #151830 100%)",
          color: "#eceef8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -120,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(125,123,255,0.45) 0%, rgba(45,226,196,0.18) 45%, transparent 70%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="9" stroke="#7d7bff" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="3" fill="#2de2c4" />
            <path d="M16 7v6M16 19v6M7 16h6M19 16h6" stroke="#7d7bff" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="16" cy="7" r="1.6" fill="#2de2c4" />
            <circle cx="25" cy="16" r="1.6" fill="#ff6b9d" />
            <circle cx="7" cy="16" r="1.6" fill="#7d7bff" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>EnsenIA</div>
            <div style={{ fontSize: 14, letterSpacing: 4, color: "#9aa0bf", textTransform: "uppercase" }}>
              Facultad de Derecho · UNT
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Derecho de las Nuevas Tecnologías y Bioderecho en el siglo XXI
          </div>
          <div style={{ fontSize: 26, color: "#9aa0bf", maxWidth: 900, lineHeight: 1.35 }}>
            Campus digital: clases grabadas procesadas con IA, placas interactivas, lenguaje simple y feedback personalizado.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["Nuevas tecnologías", "Bioderecho", "IA generativa"].map((t, i) => (
            <div
              key={t}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: `1px solid ${["#7d7bff", "#2de2c4", "#ff6b9d"][i]}`,
                color: ["#7d7bff", "#2de2c4", "#ff6b9d"][i],
                fontSize: 18,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
