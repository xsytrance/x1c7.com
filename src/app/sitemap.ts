import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "music", "projects", "classified", "art", "war-room", "level-ready", "agents", "notes"];
  return routes.map((route) => ({
    url: `https://x1c7.com${route ? `/${route}` : ""}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
