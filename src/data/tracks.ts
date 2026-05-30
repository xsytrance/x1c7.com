export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  art: string;
  genre: string;
  mood?: string;
  color: string;
  audioUrl?: string;       // Local audio file URL for custom player
  soundcloudUrl?: string;  // SoundCloud embed URL
  featured?: boolean;
};
const R2_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

export const tracks: Track[] = [
  {
    id: "first-transmission",
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/first-transmission.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/neon-dreams.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/void-walker.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/signal-acquired.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/pulse-protocol.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/ghost-frequency.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/midnight-core.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/entropy-rise.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/quantum-echo.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/system-override.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/starfield-lullaby.mp3",
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
    audioUrl: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/final-broadcast.mp3",
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

export const musicSources = [
  { name: "SoundCloud", description: "The archive. Beats, experiments, and works in progress.", url: "https://soundcloud.com", color: "#ff9b3d" },
  { name: "Suno", description: "AI-generated transmissions. Songs born from prompts.", url: "https://suno.ai", color: "#ff2bd6" },
];
