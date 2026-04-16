import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary brand — deep oxford navy with a slightly warm undertone.
        // Reads as "senior counsel", not "80s neon."
        marcoreid: {
          50: "#f4f6fb",
          100: "#e6ebf4",
          200: "#c5cfe3",
          300: "#97a7c9",
          400: "#6279a7",
          500: "#3f5888",
          600: "#2a4270",
          700: "#1f3058",
          800: "#162340",
          900: "#101a30",
          950: "#070c1c",
        },
        // Restrained brass for active indicators, dividers, small accents.
        // Never loud; used like a pen-nib highlight.
        brass: {
          50: "#fbf7ec",
          100: "#f4eacc",
          200: "#e9d597",
          300: "#dabc5e",
          400: "#c9a13b",
          500: "#b0872c",
          600: "#8f6b23",
          700: "#6e511c",
          800: "#523d18",
          900: "#3a2b13",
          950: "#201708",
        },
        // Warm ink charcoal (dark) / warm parchment (light) — overridden per
        // theme in globals.css.
        surface: {
          0: "#0a0b11",
          50: "#0f1017",
          100: "#15171f",
          200: "#1c1e29",
          300: "#262937",
          400: "#323547",
          500: "#50546a",
          600: "#767a92",
          700: "#a0a4b6",
          800: "#cbcdd7",
          900: "#e8e9ef",
          950: "#f6f6f9",
        },
      },
      fontFamily: {
        // Editorial serif for display — headings, brand, big stats.
        display: [
          "Fraunces",
          "Source Serif Pro",
          "Charter",
          "Georgia",
          "serif",
        ],
        // Body + UI stays clean sans-serif.
        sans: [
          "Inter",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        // Multi-layer, soft, warm — replaces hard neon glows.
        elevation: "0 1px 2px rgba(10,11,17,0.08), 0 8px 24px rgba(10,11,17,0.12)",
        "elevation-lg": "0 2px 4px rgba(10,11,17,0.1), 0 16px 48px rgba(10,11,17,0.18)",
        "inset-hairline": "inset 0 0 0 1px rgba(255,255,255,0.04)",
      },
      animation: {
        "pulse-soft": "pulse-soft 2.8s ease-in-out infinite",
        "waveform": "waveform 1.4s ease-in-out infinite",
        "fade-in": "fade-in 0.35s ease-out",
        "slide-up": "slide-up 0.4s cubic-bezier(0.22,1,0.36,1)",
        "slide-down": "slide-down 0.4s cubic-bezier(0.22,1,0.36,1)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" },
        },
        "waveform": {
          "0%, 100%": { height: "4px" },
          "50%": { height: "24px" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      letterSpacing: {
        "tight-display": "-0.015em",
        "wide-caps": "0.12em",
      },
    },
  },
  plugins: [],
} satisfies Config;
