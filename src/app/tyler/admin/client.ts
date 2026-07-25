"use client";

import type { TylerMedia, TylerSite, TylerTrack } from "@/lib/tyler/types";

interface LoadResponse {
  ok: boolean;
  error?: string;
  username?: string;
  viaTailnet?: boolean;
  site?: Partial<TylerSite> | null;
  tracks: TylerTrack[];
  media: TylerMedia[];
}

export const api = {
  async get(): Promise<LoadResponse> {
    const res = await fetch("/api/tyler/content", { cache: "no-store" });
    return (await res.json()) as LoadResponse;
  },
  async post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; row?: unknown }> {
    const res = await fetch("/api/tyler/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok: boolean; error?: string };
  },
  async upload(file: File, kind: string, caption?: string): Promise<{ ok: boolean; error?: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (caption) form.append("caption", caption);
    const res = await fetch("/api/tyler/upload", { method: "POST", body: form });
    return (await res.json()) as { ok: boolean; error?: string };
  },
};

/**
 * Shrink a photo before it leaves the phone. A 12MP camera roll shot is ~6MB
 * and nothing on the page renders above 2400px — uploading the original would
 * spend Juan's data plan on pixels no one will ever see. Anything that isn't a
 * JPEG/PNG/WebP (or that the browser can't decode) passes through untouched.
 */
export async function downscale(file: File, maxEdge = 2400, quality = 0.86): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file; // never block an upload over a resize
  }
}
