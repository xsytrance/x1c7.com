import { ImageResponse } from "next/og";
import { getTylerSite } from "@/lib/tyler/read";

export const runtime = "edge";
export const alt = "Tyler Haze — The Party Left Without Me";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const site = await getTylerSite();
  const { primary, secondary, accent, bg } = site.palette;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: bg, color: "#f4f1ea", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 92% 12%, ${accent}55, transparent 37%), radial-gradient(circle at 14% 88%, ${primary}55, transparent 42%)` }} />
        {site.cover ? (
          <img src={site.cover} alt="" width={500} height={500} style={{ margin: "65px 0 65px 65px", borderRadius: 18, objectFit: "cover", border: `2px solid ${secondary}88`, boxShadow: "0 30px 80px rgba(0,0,0,.65)" }} />
        ) : (
          <div style={{ width: 500, height: 500, margin: "65px 0 65px 65px", borderRadius: 18, background: `linear-gradient(135deg, ${primary}, ${accent})` }} />
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 65px 0 55px" }}>
          <div style={{ display: "flex", fontSize: 21, letterSpacing: 7, color: secondary, textTransform: "uppercase" }}>{site.by_line}</div>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 800, color: primary, marginTop: 16 }}>{site.artist}</div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 900, lineHeight: 1.02, marginTop: 10 }}>{site.album}</div>
          {site.tagline && <div style={{ display: "flex", fontSize: 23, color: "rgba(244,241,234,.76)", marginTop: 26 }}>{site.tagline}</div>}
          <div style={{ display: "flex", fontSize: 18, color: "rgba(244,241,234,.48)", marginTop: 26 }}>tyler.x1c7.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
