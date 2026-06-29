// ═══════════════════════════════════════════════════════════════════════════
//  x1c7 Project Registry — curated, real builds from the xsytrance arsenal
// ═══════════════════════════════════════════════════════════════════════════
//
//  Each entry is a real repo. Categories map to the things x1c7 is about:
//  AI music, AI art, agents, fantasy consoles, the Vera save-analyzers,
//  systems/tools, and raw ideas / research.
//
//  To add a project: drop a new entry below. The grid + terminal pick it up
//  automatically. Mark `featured: true` to surface it in the terminal `ls`.
// ═══════════════════════════════════════════════════════════════════════════

export type ProjectCategory =
  | "music"
  | "art"
  | "agents"
  | "consoles"
  | "vera"
  | "systems"
  | "ideas";

export interface CategoryMeta {
  id: ProjectCategory;
  label: string;
  blurb: string;
  color: string;
  glyph: string;
}

export const categoryMeta: Record<ProjectCategory, CategoryMeta> = {
  music: {
    id: "music",
    label: "AI Music",
    blurb: "Players, rhythm games, and signal for the machines.",
    color: "#ff2bd6",
    glyph: "♪",
  },
  art: {
    id: "art",
    label: "AI Art & Prompts",
    blurb: "Generative surfaces, prompt labs, card intelligence.",
    color: "#ff9b3d",
    glyph: "✦",
  },
  agents: {
    id: "agents",
    label: "Agents & Automation",
    blurb: "The digital crew and the rails they run on.",
    color: "#00ffa8",
    glyph: "☉",
  },
  consoles: {
    id: "consoles",
    label: "Fantasy Consoles",
    blurb: "Aurex — LLM-powered retro machines that dream up games.",
    color: "#7c3cff",
    glyph: "◈",
  },
  vera: {
    id: "vera",
    label: "Vera Engine",
    blurb: "Reconstruct characters from raw game saves. Then talk to them.",
    color: "#43f7ff",
    glyph: "⌬",
  },
  systems: {
    id: "systems",
    label: "Systems & Tools",
    blurb: "Knowledge bases, inventories, ops surfaces, SDKs.",
    color: "#8dff4a",
    glyph: "▲",
  },
  ideas: {
    id: "ideas",
    label: "Ideas & Research",
    blurb: "Half-formed experiments, papers, and beautiful nonsense.",
    color: "#f5ff6b",
    glyph: "✎",
  },
};

export type ProjectStatus = "live" | "active" | "forming";

export interface Project {
  id: string;
  name: string;
  tagline: string;
  detail: string;
  category: ProjectCategory;
  language: string | null;
  repo: string;
  homepage?: string;
  status: ProjectStatus;
  featured?: boolean;
}

export const projects: Project[] = [
  // ── AI MUSIC ──────────────────────────────────────────────────────────
  {
    id: "vaib",
    name: "vAIb",
    tagline: "Music player for AI agents",
    detail:
      "Let the machines DJ. vAIb is a music player built for AI agents — the original signal source that the x1c7 player grew out of.",
    category: "music",
    language: "JavaScript",
    repo: "https://github.com/xsytrance/vAIb",
    status: "active",
    featured: true,
  },
  {
    id: "vaibout",
    name: "vAIb out!",
    tagline: "vAIb, ported to Android",
    detail:
      "The Kotlin/Android incarnation of vAIb. Same signal, now in your pocket.",
    category: "music",
    language: "Kotlin",
    repo: "https://github.com/xsytrance/vaibout",
    status: "forming",
  },
  {
    id: "fractured",
    name: "Fractured Symphony",
    tagline: "The level is the song",
    detail:
      "A retro-style rhythmic platformer where the stage and the soundtrack are the same thing. Miss the beat, miss the jump.",
    category: "music",
    language: "GDScript",
    repo: "https://github.com/xsytrance/fractured",
    status: "active",
    featured: true,
  },
  {
    id: "suno-quick-moves",
    name: "Suno Quick Moves",
    tagline: "Fast Suno workflow playbook",
    detail:
      "A quick-reference guide for Suno workflow decisions — the how-to deck for getting good tracks out of the machine fast.",
    category: "music",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/suno-quick-moves",
    homepage: "https://suno-quick-moves.vercel.app",
    status: "live",
    featured: true,
  },

  // ── AI ART & PROMPTS ──────────────────────────────────────────────────
  {
    id: "prompt-forge",
    name: "Prompt Forge",
    tagline: "Bounty board for prompt ideas",
    detail:
      "A bounty board + tutorial platform for AI prompt ideas. Interactive prompt lab, community garden, rich bounty pages, admin panel. A whole way-to-use-AI surface.",
    category: "art",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/prompt-forge",
    status: "active",
    featured: true,
  },
  {
    id: "cardforge-sanctum",
    name: "CardForge Sanctum",
    tagline: "Raw data → card intelligence",
    detail:
      "Turns raw data into stunning, editable card-intelligence surfaces for agents. Where information becomes something you can actually look at.",
    category: "art",
    language: "Python",
    repo: "https://github.com/xsytrance/cardforge-sanctum",
    status: "active",
  },

  // ── AGENTS & AUTOMATION ───────────────────────────────────────────────
  {
    id: "agent-portal",
    name: "Agent Portal",
    tagline: "A living agent in a webpage",
    detail:
      "A living AI agent embedded in a webpage — floating eye, three starter agents, a chat UI, and an admin panel. The crew, made visible.",
    category: "agents",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/agent-portal",
    status: "active",
    featured: true,
  },
  {
    id: "dazzler",
    name: "Dazzler",
    tagline: "Signal-amplification agent",
    detail:
      "The audio specialist of the crew. Beat detection, stem separation, sonic texture. Still in training — learning good noise from bad.",
    category: "agents",
    language: null,
    repo: "https://github.com/xsytrance/dazzler",
    status: "forming",
  },
  {
    id: "commsnexus",
    name: "CommsNexus",
    tagline: "Message routing for the fleet",
    detail:
      "The comms backbone — routing messages and coordination across the agent fleet.",
    category: "agents",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/commsnexus",
    status: "forming",
  },
  {
    id: "masterdrive",
    name: "MasterDrive",
    tagline: "Backup service for AI agents",
    detail:
      "A backup service for AI agents. Memory is sacred — never lose an agent's state again.",
    category: "agents",
    language: null,
    repo: "https://github.com/xsytrance/masterdrive",
    status: "forming",
  },

  // ── FANTASY CONSOLES (AUREX) ──────────────────────────────────────────
  {
    id: "aurex16pp",
    name: "Aurex-16++",
    tagline: "Futuristic retro LLM console",
    detail:
      "A futuristic-retro, LLM-powered fantasy console. The flagship of the Aurex line.",
    category: "consoles",
    language: "Rust",
    repo: "https://github.com/xsytrance/aurex16pp",
    status: "active",
    featured: true,
  },
  {
    id: "aurex-x-codex",
    name: "Aurex-X Codex",
    tagline: "Procedural demoscene console",
    detail:
      "A fantasy console based on demoscene demos — it creates and plays procedurally generated, demoscene-like games on the fly.",
    category: "consoles",
    language: "Rust",
    repo: "https://github.com/xsytrance/aurex-x_codex",
    status: "active",
  },
  {
    id: "aurex-reboot",
    name: "Aurex-X Reboot",
    tagline: "Rebuilt on OpenClaw",
    detail:
      "The Aurex-X reboot, rebuilt using OpenClaw on Gemini. A clean-slate take on the console.",
    category: "consoles",
    language: "Rust",
    repo: "https://github.com/xsytrance/aurex-reboot",
    status: "forming",
  },
  {
    id: "aurex-x-windsurf",
    name: "Aurex-X Windsurf",
    tagline: "Aurex-X, repaired",
    detail:
      "Using Windsurf to fix and extend the Aurex-X codebase — an experiment in AI-assisted repair.",
    category: "consoles",
    language: "Rust",
    repo: "https://github.com/xsytrance/aurex-x_windsurf",
    status: "forming",
  },

  // ── VERA ENGINE ───────────────────────────────────────────────────────
  {
    id: "multivera-frontend",
    name: "MultiVera",
    tagline: "Character Context Engine",
    detail:
      "A Character Context Engine + interaction platform. Reconstruct characters from game saves across titles, then actually talk to them. React frontend over the multivera core.",
    category: "vera",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/multivera-frontend",
    status: "active",
    featured: true,
  },
  {
    id: "fft-psx-vera",
    name: "FFT-PSX Vera",
    tagline: "Tactics save analyzer + chat",
    detail:
      "Final Fantasy Tactics (PSX) save analyzer and character chat. Parses your save, reconstructs the unit, and lets you talk to it.",
    category: "vera",
    language: "Python",
    repo: "https://github.com/xsytrance/fft-psx-vera",
    status: "active",
  },
  {
    id: "ivalicevera",
    name: "IvaliceVera",
    tagline: "Ivalice Chronicles parser",
    detail:
      "Parses FFT: Ivalice Chronicles saves for MultiVera integration. Save-state archaeology for the Ivalice timeline.",
    category: "vera",
    language: "Python",
    repo: "https://github.com/xsytrance/ivalicevera",
    status: "active",
  },
  {
    id: "chronovera-frontend",
    name: "ChronoVera",
    tagline: "Chrono-flavored Vera",
    detail: "A Chrono-themed frontend in the Vera family of save analyzers.",
    category: "vera",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/chronovera-frontend",
    status: "forming",
  },
  {
    id: "undertale-vera",
    name: "Undertale Vera",
    tagline: "Determination, parsed",
    detail:
      "Save-state archaeology for Undertale — character context pulled straight from the raw save.",
    category: "vera",
    language: "Python",
    repo: "https://github.com/xsytrance/undertale-vera",
    status: "forming",
  },
  {
    id: "isaac-vera",
    name: "Isaac Vera",
    tagline: "Basement runs, remembered",
    detail:
      "A Binding of Isaac entry in the Vera family — reconstructing run context from save data.",
    category: "vera",
    language: "Python",
    repo: "https://github.com/xsytrance/isaac-vera",
    status: "forming",
  },
  {
    id: "metalgear-vera",
    name: "Metal Gear Vera",
    tagline: "Tactical espionage saves",
    detail:
      "A Metal Gear entry in the Vera family — save analysis with a tactical-espionage twist.",
    category: "vera",
    language: "HTML",
    repo: "https://github.com/xsytrance/metalgear-vera",
    status: "forming",
  },

  // ── SYSTEMS & TOOLS ───────────────────────────────────────────────────
  {
    id: "singularity",
    name: "Singularity",
    tagline: "Local-first knowledge engine",
    detail:
      "A local-first system that reconstructs structured knowledge from raw personal data — ingests files, extracts text, detects duplicates, groups content, and builds deterministic timelines and reports. No cloud, no LLM required.",
    category: "systems",
    language: "Python",
    repo: "https://github.com/xsytrance/singularity",
    status: "active",
    featured: true,
  },
  {
    id: "second-brain-sdk",
    name: "Second Brain SDK",
    tagline: "Encrypted, event-sourced memory",
    detail:
      "An event-sourced personal knowledge base SDK with an encrypted vault and built-in credential manager. Your memory, sealed.",
    category: "systems",
    language: "Python",
    repo: "https://github.com/xsytrance/second-brain-sdk",
    status: "active",
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "IT asset inventory & governance",
    detail:
      "A web-based IT asset inventory and governance tool. Know what you have, who owns it, and where it lives.",
    category: "systems",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/atlas",
    status: "active",
  },
  {
    id: "primedesk",
    name: "PrimeDesk",
    tagline: "Operator's desk",
    detail: "Internal ops tooling — the operator's desk for running the hub.",
    category: "systems",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/primedesk",
    status: "forming",
  },
  {
    id: "warroom",
    name: "War Room",
    tagline: "Command & control board",
    detail:
      "A command-and-control board for project coordination and agent ops. The backend energy behind the hub's War Room portal.",
    category: "systems",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/warroom",
    status: "forming",
  },
  {
    id: "x1c7",
    name: "x1c7.com",
    tagline: "This hub",
    detail:
      "The portal hub you are navigating right now. A Next.js cyber-mystic command center built with Tailwind and Framer Motion.",
    category: "systems",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/x1c7.com",
    homepage: "https://x1c7.com",
    status: "live",
  },

  // ── IDEAS & RESEARCH ──────────────────────────────────────────────────
  {
    id: "tpr-paper",
    name: "TPR Paper",
    tagline: "Modeling technological evolution",
    detail:
      "A framework for modeling technological evolution using commit-like structures and selection-pressure annotation across objective and subjective factors. A real paper, in LaTeX.",
    category: "ideas",
    language: "TeX",
    repo: "https://github.com/xsytrance/tpr-paper",
    status: "active",
    featured: true,
  },
  {
    id: "crescendo",
    name: "Crescendo",
    tagline: "Roguelike solitaire",
    detail: "Roguelike Solitary — a solitaire game with roguelike escalation.",
    category: "ideas",
    language: null,
    repo: "https://github.com/xsytrance/crescendo",
    status: "forming",
  },
  {
    id: "sayhai",
    name: "SayhAI",
    tagline: "Say hi to the machine",
    detail: "A small conversational probe — an experiment in saying hi to AI.",
    category: "ideas",
    language: "Python",
    repo: "https://github.com/xsytrance/sayhai",
    status: "forming",
  },
  {
    id: "whatsinyourglass",
    name: "What's In Your Glass",
    tagline: "A playful data experiment",
    detail: "A playful data/vision experiment. Exactly what it says on the label.",
    category: "ideas",
    language: "Python",
    repo: "https://github.com/xsytrance/whatsinyourglass",
    status: "forming",
  },
  {
    id: "lovelink",
    name: "LoveLink",
    tagline: "Portal for distant lovers",
    detail:
      "A personal webcam portal built for long-distance lovers. Soft tech for keeping people close.",
    category: "ideas",
    language: "JavaScript",
    repo: "https://github.com/xsytrance/lovelink",
    status: "forming",
  },
  {
    id: "boricuapunk",
    name: "BoricuaPunk",
    tagline: "An aesthetic experiment",
    detail: "A Boricua-punk styling and aesthetic experiment. Flavor over function.",
    category: "ideas",
    language: "TypeScript",
    repo: "https://github.com/xsytrance/boricuapunk",
    status: "forming",
  },
];

export const featuredProjects = projects.filter((p) => p.featured);

export const projectCategories = Object.values(categoryMeta);

export function projectsByCategory(category: ProjectCategory): Project[] {
  return projects.filter((p) => p.category === category);
}

export function categoryColor(category: ProjectCategory): string {
  return categoryMeta[category].color;
}

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function relatedProjects(project: Project, limit = 3): Project[] {
  return projects
    .filter((p) => p.category === project.category && p.id !== project.id)
    .slice(0, limit);
}
