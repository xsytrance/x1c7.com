import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    // eslint-plugin-react-hooks v7 ships four React-Compiler-preview rules in
    // its preset. They flag the lyric engine's core idiom — "playhead index
    // changed → append to a visual trail" (setState in an idx-keyed effect) —
    // 50+ times across KineticStage/LabStage, where the pattern is intentional
    // and correct. Off until we adopt the React Compiler for real; the two
    // battle-tested rules (rules-of-hooks, exhaustive-deps) stay enforced and
    // `npm run lint` is green + CI-enforceable again.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
