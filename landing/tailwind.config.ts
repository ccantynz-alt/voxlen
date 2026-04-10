import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        voxlen: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#598bff",
          500: "#3366ff",
          600: "#1a45f5",
          700: "#1333e1",
          800: "#162bb6",
          900: "#18298f",
          950: "#141b57",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
