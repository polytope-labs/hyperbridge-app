import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ["./tsconfig.app.json"],
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    passWithNoTests: true,
    setupFiles: [
      "./src/core/lib/polyfill.ts",
      "./src/core/test/setup.ts",
    ],
    env: {
      VITE_LOG_LEVEL: "info",
    },
  },
})
