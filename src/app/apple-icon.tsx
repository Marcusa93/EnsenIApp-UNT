import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono iOS: la placa carmesí de EnsenIA (líneas de clase + nodo IA). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#a81828",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 32 32" fill="none">
          <g stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round">
            <path d="M8 9.5h16" />
            <path d="M8 14.5h10" />
            <path d="M8 19.5h16" />
            <path d="M8 24.5h12" />
          </g>
          <circle cx="22.5" cy="14.5" r="2.3" fill="#4cc3ba" />
        </svg>
      </div>
    ),
    size,
  );
}
