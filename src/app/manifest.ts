import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "x1c7 — Creative Command Hub",
    short_name: "x1c7",
    description: "Music, machines, agents, experiments. A portal map by xsy.",
    start_url: "/",
    display: "standalone",
    background_color: "#05030b",
    theme_color: "#05030b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
