import { defineConfig } from "vitest/config";

export default defineConfig({ test: { setupFiles: ["tests/helpers/frenchLocale.ts"], globalSetup: ["tests/helpers/buildCss.ts"] } });
