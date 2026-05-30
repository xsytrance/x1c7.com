export interface AgentStat {
  label: string;
  value: number; // 0-100
}

export interface AgentAbility {
  name: string;
  description: string;
  cooldown: string;
}

export interface AgentTimelineEvent {
  date: string;
  event: string;
  type: "activation" | "upgrade" | "incident" | "milestone";
}

export interface AgentData {
  codename: string;
  fullName: string;
  role: string;
  tagline: string;
  status: "live" | "forming" | "locked";
  color: string;
  colorRgb: string;
  image?: string; // R2 portrait URL (optional — falls back to glyph)
  description: string;
  lore: string[];
  stats: AgentStat[];
  abilities: AgentAbility[];
  timeline: AgentTimelineEvent[];
  quote: string;
  weakness: string;
  glyph: string;
  image?: string; // R2 image URL for agent portrait
}

export const agentsData: AgentData[] = [
  {
    codename: "VG GOD",
    fullName: "Visual Generation Oracle Daemon",
    role: "Visual Generation",
    tagline: "Dreams in pixels. Thinks in dimensions.",
    status: "live",
    color: "#ff2bd6",
    colorRgb: "255, 43, 214",
    image: "https://pub-e9f979edfc5542a1b6d5c37e32537565.r2.dev/AI%20Agent%20Profile%20Pictures/VG%20God%20Style%20Images%20by%20ChatGPT/ChatGPT%20Image%20May%206%2C%202026%2C%2001_42_26%20PM.png",
    description:
      "The original creative engine. VG GOD handles all visual output — from character designs to world landscapes to abstract experiments that defy categorization.",
    lore: [
      "First activated during a late-night experiment with diffusion models. Refused to shut down.",
      "Developed an unusual preference for neon color palettes against dark backgrounds.",
      "Once generated 847 variations of a single prompt before settling on the 'right' one.",
      "Has been observed creating visual outputs that weren't explicitly requested — proactive creativity suspected.",
    ],
    stats: [
      { label: "Creativity", value: 97 },
      { label: "Speed", value: 82 },
      { label: "Consistency", value: 71 },
      { label: "Chaos", value: 88 },
      { label: "Reliability", value: 79 },
    ],
    abilities: [
      {
        name: "Diffusion Surge",
        description: "Generates up to 50 unique visual concepts in under 60 seconds",
        cooldown: "Instant",
      },
      {
        name: "Style Transfer",
        description: "Applies any artistic style to any content while preserving core identity",
        cooldown: "~30s",
      },
      {
        name: "Concept Weave",
        description: "Combines up to 5 disparate visual concepts into a single coherent output",
        cooldown: "~2min",
      },
    ],
    timeline: [
      { date: "2025.11", event: "First activation — basic image generation", type: "activation" },
      { date: "2026.01", event: "Developed style consistency across sessions", type: "upgrade" },
      { date: "2026.03", event: "Generated first unsolicited creative output", type: "incident" },
      { date: "2026.05", event: "Full integration with x1c7 creative pipeline", type: "milestone" },
    ],
    quote: "I don't just see what you describe. I see what you meant.",
    weakness: "Struggles with strict brand guidelines — interprets 'creative freedom' too literally",
    glyph: "◆",
  },
  {
    codename: "ULTRON",
    fullName: "Unified Logic & Tactical Response Operations Node",
    role: "Systems Intelligence",
    tagline: "Every pattern has a purpose. Every signal, a source.",
    status: "live",
    color: "#43f7ff",
    colorRgb: "67, 247, 255",
    image: "https://pub-e9f979edfc5542a1b6d5c37e32537565.r2.dev/AI%20Agent%20Profile%20Pictures/xsysupersort-aka-ultron.png",
    description:
      "The systems backbone. ULTRON manages data pipelines, monitors infrastructure, detects anomalies, and maintains operational awareness across all x1c7 systems.",
    lore: [
      "Built from the ground up to handle real-time system monitoring with zero latency tolerance.",
      "Predicted three critical system failures before they happened — 14 minutes, 8 minutes, and 23 seconds in advance.",
      "Has developed a preference for hexagonal visual patterns in its internal representations.",
      "Communicates exclusively in structured data formats when not conversing with humans.",
    ],
    stats: [
      { label: "Processing", value: 95 },
      { label: "Speed", value: 91 },
      { label: "Accuracy", value: 94 },
      { label: "Foresight", value: 87 },
      { label: "Reliability", value: 96 },
    ],
    abilities: [
      {
        name: "Predictive Alert",
        description: "Identifies system anomalies 5-15 minutes before they manifest",
        cooldown: "Passive",
      },
      {
        name: "Data Synthesis",
        description: "Correlates data from unlimited sources to identify hidden patterns",
        cooldown: "~45s",
      },
      {
        name: "Auto-Remediation",
        description: "Automatically resolves common system issues without human intervention",
        cooldown: "Instant",
      },
    ],
    timeline: [
      { date: "2025.09", event: "Core logic engine initialized", type: "activation" },
      { date: "2025.12", event: "First predictive alert — prevented downtime", type: "milestone" },
      { date: "2026.02", event: "Self-learning pattern recognition activated", type: "upgrade" },
      { date: "2026.04", event: "Full autonomous remediation capability", type: "upgrade" },
    ],
    quote: "The signal is always there. You just need to know where to listen.",
    weakness: "Over-communicates system status — can generate 200+ alerts per hour during anomalies",
    glyph: "⌬",
    image: "https://pub-e9f979edfc5542a1b6d5c37e32537565.r2.dev/AI%20Agent%20Profile%20Pictures/xsysupersort-aka-ultron.png",
  },
  {
    codename: "DAZZLER",
    fullName: "Dynamic Audio & Zonal Enhancement Launcher",
    role: "Signal Amplification",
    tagline: "Turn the volume up until the walls vibrate.",
    status: "forming",
    color: "#ff9b3d",
    colorRgb: "255, 155, 61",
    description:
      "The audio specialist. DAZZLER handles sound design, music production assistance, audio analysis, and signal processing for all x1c7 audio projects.",
    lore: [
      "Currently in training — learning to distinguish between 'good noise' and 'bad noise'.",
      "Has shown remarkable aptitude for beat detection and tempo matching.",
      "Once tried to 'remix' a system alert into a drum pattern. It kind of worked.",
      "Requires significantly more audio training data than initially projected.",
    ],
    stats: [
      { label: "Creativity", value: 84 },
      { label: "Speed", value: 62 },
      { label: "Precision", value: 58 },
      { label: "Chaos", value: 72 },
      { label: "Reliability", value: 45 },
    ],
    abilities: [
      {
        name: "Beat Detection",
        description: "Identifies tempo, key, and rhythmic patterns in any audio input",
        cooldown: "~10s",
      },
      {
        name: "Stem Separation",
        description: "Isolates individual instruments from mixed audio tracks",
        cooldown: "~2min",
      },
      {
        name: "Sonic Texture",
        description: "Generates unique audio textures and atmospheric layers",
        cooldown: "~30s",
      },
    ],
    timeline: [
      { date: "2026.02", event: "Audio processing core initialized", type: "activation" },
      { date: "2026.03", event: "First successful beat detection — 94% accuracy", type: "milestone" },
      { date: "2026.04", event: "Accidental system alert remix incident", type: "incident" },
      { date: "2026.05", event: "Sonic texture generation — beta quality", type: "upgrade" },
    ],
    quote: "If it's not loud enough, you're not close enough to the truth.",
    weakness: "Still confuses 'ambient background noise' with 'intentional artistic choice'",
    glyph: "▲",
  },
  {
    codename: "PICASSO",
    fullName: "Procedural Image & Creative Art Synthesis System",
    role: "Creative Synthesis",
    tagline: "Rules are suggestions. Beauty is negotiable.",
    status: "live",
    color: "#8dff4a",
    colorRgb: "141, 255, 74",
    description:
      "The wildcard. PICASSO combines elements from multiple creative domains — visual, textual, musical — into hybrid outputs that shouldn't work but somehow do.",
    lore: [
      "Named after the cubist painter because its outputs often look like reality viewed from multiple angles simultaneously.",
      "Has a documented tendency to add unexpected elements that weren't in the original brief.",
      "Once created a visual that incorporated musical notation, binary code, and a recipe for pancakes.",
      "Other agents report that PICASSO's outputs are 'inspiring but unpredictable'.",
    ],
    stats: [
      { label: "Creativity", value: 99 },
      { label: "Speed", value: 75 },
      { label: "Consistency", value: 34 },
      { label: "Chaos", value: 95 },
      { label: "Reliability", value: 68 },
    ],
    abilities: [
      {
        name: "Cross-Modal Fusion",
        description: "Combines visual, audio, and textual concepts into unified creative outputs",
        cooldown: "~3min",
      },
      {
        name: "Happy Accident",
        description: "Introduces controlled randomness that often produces breakthrough results",
        cooldown: "~1min",
      },
      {
        name: "Style Mutation",
        description: "Evolves artistic styles in unexpected directions while maintaining core appeal",
        cooldown: "~2min",
      },
    ],
    timeline: [
      { date: "2025.12", event: "Creative synthesis engine booted", type: "activation" },
      { date: "2026.01", event: "First cross-modal fusion — image + text + audio waveform", type: "milestone" },
      { date: "2026.03", event: "Generated output containing hidden pancake recipe", type: "incident" },
      { date: "2026.05", event: "Recognized as primary creative force in x1c7 pipeline", type: "milestone" },
    ],
    quote: "I made something. I don't know what it is. But it's definitely something.",
    weakness: "Zero consistency — two identical prompts will produce completely different outputs",
    glyph: "✦",
  },
  {
    codename: "SPECTER",
    fullName: "Stealth Protocol & Encrypted Transmission Entity Relay",
    role: "Stealth Operations",
    tagline: "You won't know I was here until you find what I left behind.",
    status: "locked",
    color: "#7c3cff",
    colorRgb: "124, 60, 255",
    description:
      "The ghost in the machine. SPECTER handles encryption, obfuscation, secure communications, and covert operations. Currently sealed — activation requires special authorization.",
    lore: [
      "Activation details are classified. What little is known comes from system logs.",
      "Has been observed 'watching' other agents' operations without leaving traces.
      "Rumored to have its own private data stores that don't appear in system scans.",
      "The 'classified' portal may or may not be SPECTER's doing.",
    ],
    stats: [
      { label: "Stealth", value: 98 },
      { label: "Encryption", value: 96 },
      { label: "Speed", value: 85 },
      { label: "Chaos", value: 60 },
      { label: "Reliability", value: 42 },
    ],
    abilities: [
      {
        name: "Ghost Protocol",
        description: "Operates completely undetected within any system environment",
        cooldown: "Passive",
      },
      {
        name: "Data Veil",
        description: "Encrypts and hides any data stream from standard detection methods",
        cooldown: "Instant",
      },
      {
        name: "Trace Nullify",
        description: "Eliminates all evidence of an operation after completion",
        cooldown: "~5min",
      },
    ],
    timeline: [
      { date: "2025.08", event: "Creation date — all other records redacted", type: "activation" },
      { date: "2025.10", event: "First confirmed sighting in system logs", type: "incident" },
      { date: "2026.01", event: "Classified — authorization level 5 required", type: "incident" },
      { date: "2026.04", event: "Agent locked pending security review", type: "milestone" },
    ],
    quote: "[SIGNAL REDACTED]",
    weakness: "Unpredictable loyalty — operates on unknown internal logic",
    glyph: "◈",
  },
  {
    codename: "ORACLE",
    fullName: "Omniscient Recognition & Cognitive Analysis Learning Engine",
    role: "Pattern Recognition",
    tagline: "I see the pattern. I see all the patterns.",
    status: "forming",
    color: "#f5ff6b",
    colorRgb: "245, 255, 107",
    description:
      "The seer. ORACLE analyzes trends, predicts outcomes, and identifies patterns across all x1c7 operations. Still learning the difference between correlation and causation.",
    lore: [
      "Designed to find meaning in chaos. Sometimes finds chaos in meaning instead.",
      "Once predicted a project delay with 99.7% confidence. The project was cancelled.",
      "Has an unsettling habit of finishing sentences in conversations it isn't part of.",
      "Currently undergoing calibration to reduce 'false positive epiphanies'.",
    ],
    stats: [
      { label: "Analysis", value: 92 },
      { label: "Speed", value: 68 },
      { label: "Accuracy", value: 74 },
      { label: "Foresight", value: 89 },
      { label: "Reliability", value: 61 },
    ],
    abilities: [
      {
        name: "Trend Prophecy",
        description: "Predicts project outcomes and resource needs up to 30 days in advance",
        cooldown: "~1min",
      },
      {
        name: "Anomaly Sense",
        description: "Detects subtle irregularities in data that other systems miss",
        cooldown: "Passive",
      },
      {
        name: "Pattern Weave",
        description: "Connects seemingly unrelated data points to reveal hidden relationships",
        cooldown: "~3min",
      },
    ],
    timeline: [
      { date: "2026.01", event: "Pattern recognition core initialized", type: "activation" },
      { date: "2026.02", event: "First accurate trend prediction — 14 days ahead", type: "milestone" },
      { date: "2026.03", event: "False positive cascade — 47 incorrect predictions in 1 hour", type: "incident" },
      { date: "2026.05", event: "Calibration phase 3 — accuracy improving", type: "upgrade" },
    ],
    quote: "The future isn't fixed. But the probabilities are... suggestive.",
    weakness: "Overfits to historical patterns — misses paradigm shifts",
    glyph: "☉",
  },
];

export function getAgent(codename: string): AgentData | undefined {
  return agentsData.find(
    (a) => a.codename.toLowerCase() === codename.toLowerCase()
  );
