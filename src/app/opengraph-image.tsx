import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "x1c7 — Creative Command Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#05030b",
          position: "relative",
        }}
      >
        {/* Background gradients */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 12% 12%, rgba(255, 43, 214, 0.25), transparent 28%), radial-gradient(circle at 88% 18%, rgba(67, 247, 255, 0.22), transparent 24%), radial-gradient(circle at 50% 90%, rgba(141, 255, 74, 0.18), transparent 30%), linear-gradient(135deg, #05030b 0%, #120824 50%, #02070b 100%)",
          }}
        />

        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Logo ring */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: "conic-gradient(from 180deg, #ff2bd6, #43f7ff, #8dff4a, #ff9b3d, #7c3cff, #ff2bd6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            filter: "blur(0.5px)",
          }}
        >
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 26,
              background: "#05030b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 900,
                color: "white",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              x
            </span>
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          x1c7
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            marginTop: 16,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Creative Command Hub
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.45)",
            marginTop: 24,
            fontFamily: "monospace",
            textAlign: "center",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Music, machines, agents, experiments
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(to right, #ff2bd6, #43f7ff, #8dff4a, #ff9b3d, #7c3cff)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
