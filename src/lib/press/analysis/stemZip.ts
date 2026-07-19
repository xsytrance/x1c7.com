// vendored-from: /home/xsyprime/kinetica/src/ingest/stemZip.ts — keep in step
// (docs/ENGINE-SYNC.md). Suno stem zip → decoded role buckets. On-device only.
import JSZip from "jszip";

export type StemRole = "lead" | "back" | "drums" | "bass" | "synth" | "other";

export interface LoadedStems {
  roles: Partial<Record<StemRole, AudioBuffer>>;
  names: string[];
  sampleRate: number;
  duration: number;
}

const AUDIO_RE = /\.(mp3|wav|flac|ogg|m4a|aac)$/i;

export function classifyStem(filename: string): StemRole {
  const n = filename.toLowerCase();
  if (/back|harmon|choir|adlib|ad-lib/.test(n)) return "back";
  if (/lead|vocal|vox|voice/.test(n)) return "lead";
  if (/drum|kick|snare|hat|beat/.test(n)) return "drums";
  if (/bass|808|sub/.test(n)) return "bass";
  if (/synth|keys|keyboard|piano|pad|organ/.test(n)) return "synth";
  return "other";
}

function mixInto(ac: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
  const len = Math.max(...buffers.map((b) => b.length));
  const out = ac.createBuffer(1, len, buffers[0].sampleRate);
  const o = out.getChannelData(0);
  for (const b of buffers) {
    const chs = b.numberOfChannels;
    for (let c = 0; c < chs; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) o[i] += d[i] / chs;
    }
  }
  return out;
}

export async function loadStemZip(file: File | Blob, onProgress?: (msg: string) => void): Promise<LoadedStems> {
  onProgress?.("unzipping stems…");
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir && AUDIO_RE.test(f.name) && !f.name.startsWith("__MACOSX"));
  if (!entries.length) throw new Error("no audio stems in the zip — Suno stem zips carry .mp3s like “0 Lead Vocals.mp3”");
  const ac = new AudioContext();
  const buckets = new Map<StemRole, AudioBuffer[]>();
  const names: string[] = [];
  let sampleRate = 44100, duration = 0;
  for (const e of entries) {
    const base = e.name.split("/").pop() || e.name;
    onProgress?.(`decoding ${base}…`);
    const buf = await ac.decodeAudioData((await e.async("arraybuffer")).slice(0));
    sampleRate = buf.sampleRate;
    duration = Math.max(duration, buf.duration);
    const role = classifyStem(base);
    (buckets.get(role) ?? buckets.set(role, []).get(role)!).push(buf);
    names.push(base);
  }
  const roles: Partial<Record<StemRole, AudioBuffer>> = {};
  for (const [role, bufs] of buckets) roles[role] = bufs.length === 1 ? bufs[0] : mixInto(ac, bufs);
  await ac.close();
  return { roles, names, sampleRate, duration };
}
