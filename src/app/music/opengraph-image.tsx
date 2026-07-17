import { ImageResponse } from "next/og";
import { TYLER } from "@/data/tylerhaze";

// /music share card — Tyler Haze takeover edition (2026-07-17). The album
// cover rides the left half; the right half carries the announcement. Delete
// this file to fall back to the site-wide OG image.

export const runtime = "edge";
export const alt = "Tyler Haze — The Party Left Without Me · out now · presented on x1c7.com/music";
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
          background: "linear-gradient(135deg, #080b18 0%, #131a36 55%, #1a0e14 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 85% 15%, rgba(255, 180, 92, 0.20), transparent 40%), radial-gradient(circle at 20% 90%, rgba(217, 52, 43, 0.22), transparent 45%)",
          }}
        />
        {/* cover */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={TYLER.cover}
          alt=""
          width={520}
          height={520}
          style={{
            margin: "55px 0 55px 55px",
            borderRadius: 18,
            border: "2px solid rgba(255,255,255,0.18)",
            transform: "rotate(-2deg)",
            boxShadow: "0 30px 90px rgba(0,0,0,0.8)",
          }}
        />
        {/* copy */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 60px 0 50px",
            color: "white",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, color: "#ffb45c", textTransform: "uppercase" }}>
            Out now · debut album
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#d9342b", marginTop: 14 }}>
            TYLER HAZE
          </div>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 900, lineHeight: 1.05, marginTop: 8 }}>
            {TYLER.album}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.75)", marginTop: 26 }}>
            13 tracks of alternative rock — real life, real weight.
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.5)", marginTop: 18 }}>
            presented with pride by x1c7.com/music
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
