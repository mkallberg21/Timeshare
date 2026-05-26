import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 75,
        statements: 75,
      },
      exclude: [
        "src/main.ts",
        "src/**/*.module.ts",
        "src/prisma/**",
        "prisma/**",
        "test/**",
      ],
    },
    include: ["test/**/*.spec.ts"],
    exclude: ["test/e2e/**"],
  },
});
