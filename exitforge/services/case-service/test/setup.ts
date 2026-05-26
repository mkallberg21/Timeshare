// Global test setup — runs once before all tests
// Add global mocks, custom matchers, and test DB setup here

import { vi } from "vitest";

// Silence structured logging during tests
vi.mock("../src/common/logger", () => ({
  createLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));
