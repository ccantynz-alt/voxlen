import type { Config } from "tailwindcss";

/**
 * Voxlen "legal letterhead" design system.
 *
 * Paper, ink, and brass — the materials of the professions this product
 * serves. One reserved red for proofreader's marks (the redline), used
 * nowhere else. Caslon for deeds, Public Sans for prose, Courier for
 * transcripts.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FAF7F0",
          deep: "#F3EEE2",
        },
        ink: {
          DEFAULT: "#1D1A15",
          soft: "#5B554A",
          faint: "#8A8375",
        },
        brass: {
          DEFAULT: "#A0762C",
          deep: "#7E5C20",
          wash: "#F0E7D2",
        },
        rule: "#E4DCC9",
        redline: "#96382B",
        // Legacy alias so any straggler brand-* classes fail soft to brass.
        brand: {
          50: "#F0E7D2",
          100: "#F0E7D2",
          200: "#D9C79A",
          300: "#C4A968",
          400: "#A0762C",
          500: "#A0762C",
          600: "#7E5C20",
          700: "#7E5C20",
          800: "#5F4517",
          900: "#4A3512",
          950: "#33240C",
        },
      },
      fontFamily: {
        display: ["'Libre Caslon Display'", "Georgia", "serif"],
        serif: ["'Libre Caslon Text'", "Georgia", "serif"],
        sans: ["'Public Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'Courier Prime'", "Courier New", "monospace"],
      },
      boxShadow: {
        sheet: "0 1px 2px rgba(29,26,21,0.05), 0 8px 28px rgba(29,26,21,0.08)",
        card: "0 1px 3px rgba(29,26,21,0.06)",
      },
      letterSpacing: {
        caps: "0.18em",
      },
    },
  },
  plugins: [],
} satisfies Config;
