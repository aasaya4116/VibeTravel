import { ImageResponse } from "next/og"

export const alt = "VibeTravel — Family travel, by vibe."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Branded social-share card, generated at request time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          backgroundColor: "#171512",
          backgroundImage:
            "linear-gradient(215deg, rgba(166,86,54,0.34), rgba(23,21,18,0) 55%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "34px" }}>
          <svg viewBox="0 0 512 512" width="64" height="64">
            <rect width="512" height="512" rx="112" fill="#171512" stroke="rgba(243,239,231,0.18)" strokeWidth="8" />
            <path d="M142 374V242c0-78 51-132 114-132s114 54 114 132v132" fill="none" stroke="#F3EFE7" strokeWidth="30" strokeLinecap="round" />
            <path d="M191 375c0-66 23-94 61-126 35-30 58-56 72-98" fill="none" stroke="#A65636" strokeWidth="24" strokeLinecap="round" />
            <circle cx="327" cy="141" r="18" fill="#C8A96E" />
          </svg>
          <div style={{ display: "flex", fontSize: "32px", letterSpacing: "0.5px" }}>VibeTravel</div>
        </div>
        <div style={{ display: "flex", fontSize: "78px", fontWeight: 700, lineHeight: 1.05 }}>
          Your family&apos;s next adventure,
        </div>
        <div style={{ display: "flex", fontSize: "78px", fontWeight: 700, fontStyle: "italic", color: "#A65636", lineHeight: 1.05 }}>
          by vibe.
        </div>
        <div style={{ display: "flex", fontSize: "30px", color: "rgba(255,255,255,0.6)", marginTop: "34px", maxWidth: "860px" }}>
          AI trip planning that knows your kids&apos; ages, sensory needs, and travel pace.
        </div>
      </div>
    ),
    { ...size }
  )
}
