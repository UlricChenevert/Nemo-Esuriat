import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Restricted to .ts so compiled .js siblings are never collected as duplicates.
    include: ["Client/Scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "bin/**", "obj/**", "wwwroot/**"],
    // No global environment: suites that need a DOM opt in with a
    // `// @vitest-environment happy-dom` docblock, as GameSystems.test.ts does.
  },
});
