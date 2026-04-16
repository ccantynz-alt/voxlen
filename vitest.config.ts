import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Keep test config separate from `vite.config.ts` so the Tauri dev server
// never pulls in test-only plugins. Aliases match src/tsconfig.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
