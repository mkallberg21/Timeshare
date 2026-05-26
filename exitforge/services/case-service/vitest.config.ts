import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/unit/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: { lines: 80, branches: 75, functions: 80 },
      exclude: [
        "**/*.module.ts",
        "**/main.ts",
        "**/*.dto.ts",
        "**/*.entity.ts",
        "**/index.ts",
        "**/prisma/prisma.service.ts",
        "test/**",
        "prisma/**",
      ],
    },
  },
});
