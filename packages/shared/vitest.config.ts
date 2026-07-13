import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["test/**/*.spec.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 90,
        functions: 80,
        branches: 90,
        statements: 90,
      },
    },
  },
});
