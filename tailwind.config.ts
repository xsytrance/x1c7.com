import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      spacing: {
        "safe-t": "var(--safe-t)",
        "safe-b": "var(--safe-b)",
        player: "var(--player-h)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        void: "#05030b",
        plasma: "#ff2440",
        signal: "#43f7ff",
        venom: "#8dff4a",
        ember: "#ff9b3d",
        royal: "#7c3cff",
      },
      boxShadow: {
        glow: "0 0 50px rgba(67, 247, 255, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
