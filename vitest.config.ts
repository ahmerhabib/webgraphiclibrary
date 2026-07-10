import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["packages/**/*.test.ts", "scripts/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      // Measure the shipped source only — not tests, the root barrel, or the
      // integration scripts (those are exercised by check:browser / check:package).
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 95,
        lines: 90
      }
    }
  }
});
