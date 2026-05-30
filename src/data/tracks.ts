export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  durationSeconds: number;
  art: string;
  genre: string;
  mood?: string;
  audioUrl?: string;
  sunoUrl?: string;
  featured?: boolean;
  color: string;
};

export const tracks: Track[] = [
  {
    id: "first-transmission",
    title: "First Transmission",
    artist: "xsy",
    duration: "3:42",
    durationSeconds: 222,
    art: "/album-art/first-transmission.jpg",
    genre: "Electronic",
    mood: "Discovery",
    color: "#ff2bd6",
    featured: true,
  },
  {
    id: "neon-dreams",
    title: "Neon Dreams",
    artist: "xsy",
    duration: "4:15",
    durationSeconds: 255,
    art: "/album-art/neon-dreams.jpg",
    genre: "Synthwave",
    mood: "Night Drive",
    color: "#43f7ff",
  },
  {
    id: "void-walker",
    title: "Void Walker",
    artist: "xsy",
    duration: "5:01",
    durationSeconds: 301,
    art: "/album-art/void-walker.jpg",
    genre: "Ambient",
    mood: "Deep Space",
    color: "#ff9b3d",
  },
  {
    id: "signal-acquired",
    title: "Signal Acquired",
    artist: "xsy",
    duration: "3:28",
    durationSeconds: 208,
    art: "/album-art/signal-acquired.jpg",
    genre: "Electronic",
    mood: "Tension",
    color: "#8dff4a",
  },
  {
    id: "pulse-protocol",
    title: "Pulse Protocol",
    artist: "xsy",
    duration: "3:56",
    durationSeconds: 236,
    art: "/album-art/pulse-protocol.jpg",
    genre: "Techno",
    mood: "Urgent",
    color: "#7c3cff",
  },
  {
    id: "ghost-frequency",
    title: "Ghost Frequency",
    artist: "xsy",
    duration: "4:44",
    durationSeconds: 284,
    art: "/album-art/ghost-frequency.jpg",
    genre: "Ambient",
    mood: "Haunting",
    color: "#00ffa8",
  },
  {
    id: "midnight-core",
    title: "Midnight Core",
    artist: "xsy",
    duration: "3:33",
    durationSeconds: 213,
    art: "/album-art/midnight-core.jpg",
    genre: "Electronic",
    mood: "After Hours",
    color: "#ff2bd6",
  },
  {
    id: "entropy-rise",
    title: "Entropy Rise",
    artist: "xsy",
    duration: "4:08",
    durationSeconds: 248,
    art: "/album-art/entropy-rise.jpg",
    genre: "Industrial",
    mood: "Chaos",
    color: "#ff9b3d",
  },
  {
    id: "quantum-echo",
    title: "Quantum Echo",
    artist: "xsy",
    duration: "3:17",
    durationSeconds: 197,
    art: "/album-art/quantum-echo.jpg",
    genre: "Synthwave",
    mood: "Nostalgic",
    color: "#43f7ff",
  },
  {
    id: "system-override",
    title: "System Override",
    artist: "xsy",
    duration: "4:22",
    durationSeconds: 262,
    art: "/album-art/system-override.jpg",
    genre: "Techno",
    mood: "Rebellion",
    color: "#8dff4a",
  },
  {
    id: "starfield-lullaby",
    title: "Starfield Lullaby",
    artist: "xsy",
    duration: "5:12",
    durationSeconds: 312,
    art: "/album-art/starfield-lullaby.jpg",
    genre: "Ambient",
    mood: "Dreaming",
    color: "#7c3cff",
  },
  {
    id: "final-broadcast",
    title: "Final Broadcast",
    artist: "xsy",
    duration: "6:01",
    durationSeconds: 361,
    art: "/album-art/final-broadcast.jpg",
    genre: "Electronic",
    mood: "Epic",
    color: "#ff2bd6",
    featured: true,
  },
];

export const featuredTracks = tracks.filter((t) => t.featured);
export const getTrackById = (id: string) => tracks.find((t) => t.id === id);

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
];
