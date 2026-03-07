import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["test/**/*.spec.ts"],
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/main.ts",
        "src/**/*.module.ts",
        "src/**/*.spec.ts",
      ],
      thresholds: {
        lines: 65,
        functions: 55,
        branches: 75,
        statements: 65,
      },
    },
  },
});
