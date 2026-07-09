export type Portal = {
  slug: string;
  title: string;
  signal: string;
  description: string;
  details: string[];
  cta: string;
  color: string;
  glyph: string;
  status: "live" | "forming" | "locked";
};

export const portals: Portal[] = [
  {
    slug: "music",
    title: "Music",
    signal: "Suno, SoundCloud, PulseBox, Jukebox.",
    description: "Tracks, machines, visualizers, and the next loud experiment.",
    details: ["Suno transmissions", "PulseBox / Jukebox concept", "Future videos + visualizers"],
    cta: "Tune in",
    color: "#ff2440",
    glyph: "♪",
    status: "forming",
  },
  {
    slug: "galaxy",
    title: "The Galaxy",
    signal: "Every song is a planet.",
    description: "The catalog as a universe — living lyric worlds you can land on, touch, shake, and blow through.",
    details: ["15 interactive planets", "LLM-choreographed touch moments", "Word-synced kinetic shows"],
    cta: "Enter orbit",
    color: "#8b7bff",
    glyph: "🪐",
    status: "live",
  },
  {
    slug: "level-ready",
    title: "Level Ready",
    signal: "AI help for real life.",
    description: "Practical automation for people and businesses that need the future to stop being annoying.",
    details: ["AI workflows", "Business automations", "Human-first support"],
    cta: "Get ready",
    color: "#8dff4a",
    glyph: "▲",
    status: "forming",
  },
  {
    slug: "war-room",
    title: "War Room",
    signal: "Command center online.",
    description: "Project coordination, agent ops, plans, launches, and controlled chaos.",
    details: ["Operations board", "Collaboration hub", "Agent dispatch"],
    cta: "Enter ops",
    color: "#43f7ff",
    glyph: "⌬",
    status: "forming",
  },
  {
    slug: "art",
    title: "AI Art",
    signal: "XsyVerse visuals.",
    description: "Characters, worlds, strange artifacts, gallery experiments, and beautiful nonsense.",
    details: ["Gallery labs", "Worldbuilding", "Character studies"],
    cta: "Open gallery",
    color: "#ff9b3d",
    glyph: "✦",
    status: "forming",
  },
  {
    slug: "projects",
    title: "Projects",
    signal: "Apps, tools, prototypes.",
    description: "vAIb out!, Entangled, Aurex, dashboards, toys, and builds crawling out of the basement.",
    details: ["Coding experiments", "Apps + tools", "Future builds"],
    cta: "Inspect builds",
    color: "#7c3cff",
    glyph: "◈",
    status: "forming",
  },
  {
    slug: "notes",
    title: "Field Notes",
    signal: "Progress logs and weird lessons.",
    description: "Short dispatches from the lab: thoughts, experiments, mistakes, breakthroughs.",
    details: ["Build logs", "Lessons learned", "Signal reports"],
    cta: "Read notes",
    color: "#f5ff6b",
    glyph: "✎",
    status: "forming",
  },
  {
    slug: "agents",
    title: "Agent Ecosystem",
    signal: "VG God, Ultron, Dazzler, Picasso…",
    description: "A mysterious command deck for the digital crew and their questionable orders.",
    details: ["Agent roster", "Ops mythology", "Autonomous experiments"],
    cta: "Meet the crew",
    color: "#00ffa8",
    glyph: "☉",
    status: "forming",
  },
  {
    slug: "classified",
    title: "Classified",
    signal: "Some doors are locked.",
    description: "A harmless sealed portal. No secrets. Just a blinking red light and bad decisions pending.",
    details: ["Easter egg zone", "Locked portal", "Future anomaly"],
    cta: "Knock twice",
    color: "#ff3b3b",
    glyph: "?",
    status: "locked",
  },
];

export function getPortal(slug: string) {
  return portals.find((portal) => portal.slug === slug);
}
