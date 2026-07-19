"use client";

// THE BOOTH — the plant's 3D room (P6). Parametric shells only (no glTF):
// every face texture is the SAME surface pipeline the prints use, rendered at
// screen dpi, so the object in your hands is the object in the box. Loads as
// its own chunk; frameloop="demand" keeps phones cool; context loss re-uploads.
// Drag-title-on-surface is deferred (decided, not forgotten) — chrome text
// needs to become text layers first.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { getTemplate } from "@/lib/press/templates/registry";
import { exportSurfacePNG } from "@/lib/press/render/exportPng";
import { caseSpecFrom } from "@/lib/press/templates/collectorCase";
import { renderCasePNG } from "@/lib/collector/webEngine";
import type { ProjectSpec } from "@/lib/press/types";

const DARK = new THREE.MeshStandardMaterial({ color: "#0a0a10", roughness: 0.6, metalness: 0.2 });

type TexMap = Record<string, THREE.CanvasTexture>;

function useSurfaceTextures(project: ProjectSpec, artImg: HTMLImageElement | null): { tex: TexMap; version: number } {
  const [tex, setTex] = useState<TexMap>({});
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const template = getTemplate(project.templateId);
      const out: TexMap = {};
      try {
        if (template.legacy) {
          if (artImg) {
            const blob = await renderCasePNG(artImg, caseSpecFrom(project));
            const bmp = await createImageBitmap(blob);
            const c = document.createElement("canvas");
            c.width = bmp.width; c.height = bmp.height;
            c.getContext("2d")!.drawImage(bmp, 0, 0);
            out.case = new THREE.CanvasTexture(c);
          }
        } else {
          for (const s of template.surfaces) {
            const low = { ...s, exportDpi: 96 };
            const res = await exportSurfacePNG(low, project, artImg);
            const bmp = await createImageBitmap(res.blob);
            const c = document.createElement("canvas");
            c.width = bmp.width; c.height = bmp.height;
            c.getContext("2d")!.drawImage(bmp, 0, 0);
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            out[s.id] = t;
          }
        }
        setTex((old) => { Object.values(old).forEach((t) => t.dispose()); return out; });
        setVersion((v) => v + 1);
      } catch { /* texture pass failed — shell stays dark, editor unaffected */ }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [project, artImg]);
  return { tex, version };
}

const mat = (t?: THREE.Texture) => (t ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.08 }) : DARK);

function Shell({ project, tex, spin }: { project: ProjectSpec; tex: TexMap; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (spin && group.current) group.current.rotation.y += dt * 0.9; });
  const id = project.templateId;
  const kind = id.startsWith("vinyl") ? "vinyl" : id === "cassette" ? "cassette" : id === "jewel" ? "jewel" : id === "eighttrack" ? "cart" : "slab";
  const boxMats = (front?: THREE.Texture, back?: THREE.Texture, top?: THREE.Texture) =>
    [DARK, DARK, mat(top), DARK, mat(front), mat(back)];

  return (
    <group ref={group}>
      {kind === "slab" && (
        <mesh material={boxMats(tex.case)}> <boxGeometry args={[12, 12, 1.4]} /> </mesh>
      )}
      {kind === "cassette" && (
        <mesh material={boxMats(tex.labelA, tex.labelB)}> <boxGeometry args={[10.16, 6.4, 1.2]} /> </mesh>
      )}
      {kind === "cart" && (
        <mesh material={boxMats(tex.face, tex.face, tex.edge)}> <boxGeometry args={[13.3, 9.9, 2.2]} /> </mesh>
      )}
      {kind === "jewel" && (
        <>
          <mesh position={[0, 0, 0.55]} material={boxMats(tex.front)}> <boxGeometry args={[12, 12, 0.35]} /> </mesh>
          <mesh position={[0, 0, -0.55]} material={boxMats(undefined, tex.tray)}> <boxGeometry args={[12.4, 11.8, 0.5]} /> </mesh>
          <mesh position={[7.4, 0, 0]} rotation={[Math.PI / 2, 0, 0]}
            material={[DARK, mat(tex.disc), mat(tex.disc)]}> <cylinderGeometry args={[6, 6, 0.12, 48]} /> </mesh>
        </>
      )}
      {kind === "vinyl" && (
        <>
          <mesh material={boxMats(tex.sleeveFront, tex.sleeveBack)}> <boxGeometry args={[15.6, 15.6, 0.45]} /> </mesh>
          <mesh position={[10.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}
            material={[new THREE.MeshStandardMaterial({ color: "#141418", roughness: 0.35, metalness: 0.3 }), mat(tex.labelA), mat(tex.labelB)]}>
            <cylinderGeometry args={[7.6, 7.6, 0.1, 64]} />
          </mesh>
        </>
      )}
    </group>
  );
}

function ContextGuard() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => e.preventDefault();
    const restored = () => invalidate();
    el.addEventListener("webglcontextlost", lost);
    el.addEventListener("webglcontextrestored", restored);
    return () => { el.removeEventListener("webglcontextlost", lost); el.removeEventListener("webglcontextrestored", restored); };
  }, [gl, invalidate]);
  return null;
}

export default function StudioScene({ project, artImg }: { project: ProjectSpec; artImg: HTMLImageElement | null }) {
  const { tex } = useSurfaceTextures(project, artImg);
  const [spin, setSpin] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const slug = (project.identity.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

  function beautyShot() {
    const gl = glRef.current;
    if (!gl) return;
    gl.domElement.toBlob((b) => {
      if (!b) { setMsg("shot failed"); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `${slug}-booth.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("✓ beauty shot saved");
    }, "image/png");
  }

  async function loop() {
    const gl = glRef.current;
    if (!gl || busy) return;
    const ladder = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    const mime = ladder.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    if (!mime) { setMsg("this browser can't record canvases — the beauty shot always works"); return; }
    setBusy("rec"); setMsg("filming a 4s turntable loop…");
    setSpin(true);
    const stream = gl.domElement.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-loop.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("✓ loop saved — post it somewhere loud");
      setBusy(null);
    };
    rec.start();
    setTimeout(() => rec.stop(), 4000);
  }

  return (
    <div className="space-y-2">
      <div className="h-[420px] overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <Canvas
          frameloop={spin || busy ? "always" : "demand"}
          dpr={[1, 2]}
          camera={{ position: [0, 6, 26], fov: 38 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => { glRef.current = gl; }}>
          <ContextGuard />
          <color attach="background" args={["#050510"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[8, 12, 10]} intensity={1.4} />
          <directionalLight position={[-10, -4, -8]} intensity={0.35} color="#8fb0ff" />
          <Environment preset="city" />
          <Shell project={project} tex={tex} spin={spin} />
          <OrbitControls enablePan={false} minDistance={10} maxDistance={60} />
        </Canvas>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSpin((v) => !v)}
          className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-amber-300">
          {spin ? "⏸ hold it" : "▶ spin it"}
        </button>
        <button onClick={beautyShot}
          className="rounded-full border border-amber-400/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/90 hover:bg-amber-400/10">
          beauty shot (PNG)
        </button>
        <button onClick={loop} disabled={!!busy}
          className="rounded-full border border-amber-400/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/90 hover:bg-amber-400/10 disabled:opacity-40">
          {busy ? "filming…" : "4s turntable loop"}
        </button>
      </div>
      {msg && <p className="text-[11px] leading-4 text-zinc-600">{msg}</p>}
      <p className="text-[11px] leading-4 text-zinc-700">Drag to orbit · pinch/scroll to zoom. Grab-the-title-on-the-object arrives in a later run.</p>
    </div>
  );
}
