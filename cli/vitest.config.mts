import { defineConfig } from "vitest/config";

// The CLI is independently installable; do not inherit the web app's config.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
