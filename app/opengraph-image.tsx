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
          background:
            "radial-gradient(1000px 520px at 88% -8%, rgba(226,112,58,0.38), transparent), #0b0b0f",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "34px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#d4652a", display: "flex" }} />
          <div style={{ display: "flex", fontSize: "32px", letterSpacing: "0.5px" }}>VibeTravel</div>
        </div>
        <div style={{ display: "flex", fontSize: "78px", fontWeight: 700, lineHeight: 1.05 }}>
          Your family&apos;s next adventure,
        </div>
        <div style={{ display: "flex", fontSize: "78px", fontWeight: 700, fontStyle: "italic", color: "#e2703a", lineHeight: 1.05 }}>
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
