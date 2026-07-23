import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Force dev-mode React in tests: react/index.js picks the production build
    // (which lacks act()) whenever the ambient shell sets NODE_ENV=production.
    env: { NODE_ENV: "test" },
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    reporters: "default",
  },
});
