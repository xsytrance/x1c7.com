export type Track = {
  id: string;
  title: string;
  artist: string;
  source: "suno" | "soundcloud" | "pulsebox";
  duration: string;
  status: "live" | "coming-soon";
  color: string;
};

export const tracks: Track[] = [
  {
    id: "t1",
    title: "First Transmission",
    artist: "xsy",
    source: "suno",
    duration: "3:42",
    status: "coming-soon",
    color: "#ff2bd6",
  },
  {
    id: "t2",
    title: "Neon Dreams",
    artist: "xsy",
    source: "suno",
    duration: "4:15",
    status: "coming-soon",
    color: "#ff2bd6",
  },
  {
    id: "t3",
    title: "Void Walker",
    artist: "xsy",
    source: "soundcloud",
    duration: "5:01",
    status: "coming-soon",
    color: "#ff9b3d",
  },
  {
    id: "t4",
    title: "Pulse Test #1",
    artist: "PulseBox",
    source: "pulsebox",
    duration: "2:30",
    status: "coming-soon",
    color: "#8dff4a",
  },
];

export type MusicSource = {
  name: string;
  description: string;
  url?: string;
  color: string;
  status: "active" | "concept";
};

export const musicSources: MusicSource[] = [
  {
    name: "Suno",
    description: "AI-generated transmissions. Songs born from prompts and polished by human ears.",
    url: "https://suno.ai",
    color: "#ff2bd6",
    status: "active",
  },
  {
    name: "SoundCloud",
    description: "The archive. Beats, experiments, and works in progress.",
    url: "https://soundcloud.com",
    color: "#ff9b3d",
    status: "active",
  },
  {
    name: "PulseBox / Jukebox",
    description: "A concept for reactive music systems that respond to environment, mood, and signal.",
    color: "#8dff4a",
    status: "concept",
  },
];
