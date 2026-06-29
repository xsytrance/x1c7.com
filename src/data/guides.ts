// ═══════════════════════════════════════════════════════════════════════════
//  x1c7 Field Manual — how-tos, AI playbooks, field-tested ways to use AI
// ═══════════════════════════════════════════════════════════════════════════
//
//  Each guide is a short, practical protocol. Steps render as an expandable
//  checklist. Add `link` to point at a deeper resource (a repo, a live tool).
//  To add a guide: drop a new entry below — the page picks it up automatically.
// ═══════════════════════════════════════════════════════════════════════════

export type GuideCategory =
  | "music"
  | "art"
  | "prompting"
  | "agents"
  | "workflow"
  | "experiments";

export interface GuideCategoryMeta {
  id: GuideCategory;
  label: string;
  color: string;
}

export const guideCategoryMeta: Record<GuideCategory, GuideCategoryMeta> = {
  music: { id: "music", label: "AI Music", color: "#ff2bd6" },
  art: { id: "art", label: "AI Art", color: "#ff9b3d" },
  prompting: { id: "prompting", label: "Prompting", color: "#43f7ff" },
  agents: { id: "agents", label: "Agents", color: "#00ffa8" },
  workflow: { id: "workflow", label: "Workflow", color: "#8dff4a" },
  experiments: { id: "experiments", label: "Experiments", color: "#f5ff6b" },
};

export interface GuideLink {
  label: string;
  url: string;
}

export interface Guide {
  id: string;
  title: string;
  summary: string;
  category: GuideCategory;
  readTime: string;
  difficulty: "intro" | "operator" | "deep";
  steps: string[];
  link?: GuideLink;
}

export const guides: Guide[] = [
  {
    id: "suno-fast-track",
    title: "Ship a finished track from Suno in 20 minutes",
    summary:
      "A repeatable loop for getting a real, structured song out of Suno instead of an endless pile of half-ideas.",
    category: "music",
    readTime: "4 min",
    difficulty: "intro",
    steps: [
      "Name the vibe in three words before you touch the prompt (e.g. 'defiant / neon / midtempo'). That's your north star.",
      "Write lyrics with explicit structure tags — [Intro] [Verse] [Pre] [Chorus] [Bridge] [Outro]. Structure beats clever lines.",
      "Style prompt = genre + mood + 2 production cues (e.g. 'synthwave, euphoric, sidechained pads, analog warmth'). No paragraphs.",
      "Generate two variations, not ten. Pick the stronger skeleton, ignore mix flaws for now.",
      "Use Replace Section / Extend to fix only the weakest 8 bars instead of rerolling the whole song.",
      "Master to a reference: A/B against a commercial track at matched loudness, then export.",
    ],
    link: { label: "Suno Quick Moves", url: "https://github.com/xsytrance/suno-quick-moves" },
  },
  {
    id: "prompts-that-ship",
    title: "Prompt engineering that actually ships",
    summary:
      "Stop wrestling the model. Five moves that turn a vague ask into a reliable, reusable prompt.",
    category: "prompting",
    readTime: "5 min",
    difficulty: "intro",
    steps: [
      "Lead with role + task + hard constraints in the first two lines. The model anchors on what it reads first.",
      "Give exactly one worked example (one-shot). One good example outperforms three paragraphs of description.",
      "Specify the output format literally — show the shape you want, including delimiters or JSON keys.",
      "Iterate by diffing, not rewriting: change one variable per run so you know what moved the result.",
      "When a prompt wins, save it to a library with notes on why. Your prompt collection is an asset.",
    ],
    link: { label: "Prompt Forge", url: "https://github.com/xsytrance/prompt-forge" },
  },
  {
    id: "raw-to-knowledge",
    title: "Turn a folder of chaos into a knowledge base",
    summary:
      "A local-first pipeline for making years of scattered files searchable and structured — no cloud required.",
    category: "workflow",
    readTime: "6 min",
    difficulty: "operator",
    steps: [
      "Dump everything into a single inbox folder first. Don't pre-organize — that's the machine's job.",
      "Extract text from every file type (docs, PDFs, images via OCR) into a normalized form.",
      "Detect and collapse duplicates and near-duplicates before you index anything.",
      "Cluster by topic and entity so related material groups itself without manual tagging.",
      "Build a deterministic timeline + report so you can answer 'what happened when' without an LLM in the loop.",
      "Only then layer search / chat on top — over clean data, retrieval actually works.",
    ],
    link: { label: "Singularity", url: "https://github.com/xsytrance/singularity" },
  },
  {
    id: "first-agent-crew",
    title: "Stand up your first AI agent crew",
    summary:
      "How to go from one chatbot to a small team of agents that do real, bounded jobs without going rogue.",
    category: "agents",
    readTime: "6 min",
    difficulty: "operator",
    steps: [
      "Give each agent ONE narrow job. 'Summarize inbound email' beats 'be my assistant' every time.",
      "Hand it tools, not vibes — concrete functions it can call, with typed inputs and outputs.",
      "Add a memory store so it remembers context between runs instead of starting cold each time.",
      "Set guardrails: an allow-list of actions, a spend/iteration cap, and a human approval step for anything irreversible.",
      "Run it on a schedule or a trigger, not just on-demand. Autonomy shows up when it works while you sleep.",
      "Log every input, tool call, and output. When something breaks, the log is the whole story.",
    ],
    link: { label: "Agent Portal", url: "https://github.com/xsytrance/agent-portal" },
  },
  {
    id: "consistent-character",
    title: "Generate AI art with a consistent character",
    summary:
      "The difference between 'a cool image' and 'my character, again' is process. Here's the process.",
    category: "art",
    readTime: "5 min",
    difficulty: "operator",
    steps: [
      "Lock a seed and a small set of style tokens you reuse on every generation. Consistency starts with what you keep fixed.",
      "Build a character sheet first — front, side, expression studies — and treat it as ground truth.",
      "Feed a reference image (img2img / IP-adapter) so identity carries across new scenes.",
      "Vary only one axis at a time: pose OR lighting OR setting, never all three at once.",
      "Upscale and detail LAST, after you've locked composition — detailing early just wastes compute on rejects.",
    ],
    link: { label: "CardForge Sanctum", url: "https://github.com/xsytrance/cardforge-sanctum" },
  },
  {
    id: "talk-to-saves",
    title: "Talk to your old game saves",
    summary:
      "A weird-but-real project pattern: parse a game's save file into structured data, then chat with the characters in it.",
    category: "experiments",
    readTime: "4 min",
    difficulty: "deep",
    steps: [
      "Locate and export the raw save file — most are a fixed binary layout once you find the offsets.",
      "Map the bytes to structured stats: names, levels, jobs, relationships, story flags.",
      "Serialize that into a clean character context object — the model never sees raw bytes.",
      "Prompt with the character's context + a personality frame, and you can interview a 20-year-old save.",
      "Generalize the parser per title; share the structured format so one chat UI serves them all.",
    ],
    link: { label: "MultiVera", url: "https://github.com/xsytrance/multivera-frontend" },
  },
];

export const guideCategories = Object.values(guideCategoryMeta);

export function guidesByCategory(category: GuideCategory): Guide[] {
  return guides.filter((g) => g.category === category);
}
