import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#070812",
          borderRadius: 40,
        }}
      >
        <svg width="132" height="132" viewBox="0 0 32 32" fill="none">
          <rect x="1" y="1" width="30" height="30" rx="9" stroke="#7d7bff" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="3" fill="#2de2c4" />
          <path d="M16 7v6M16 19v6M7 16h6M19 16h6" stroke="#7d7bff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="7" r="1.6" fill="#2de2c4" />
          <circle cx="25" cy="16" r="1.6" fill="#ff6b9d" />
          <circle cx="7" cy="16" r="1.6" fill="#7d7bff" />
        </svg>
      </div>
    ),
    size,
  );
}
