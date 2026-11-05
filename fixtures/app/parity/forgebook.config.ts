/**
 * The fixture kit's catalogue with accessibility checks and component docs turned off, as a catalogue that wants
 * neither axe in its build nor a TypeScript program in its server: the shell's browser tests read what it offers
 * instead (`parity.e2e.ts`).
 *
 * @module
 */
import { kitPreset } from "@fixture/kit/forgebook";
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Kit without docs",
  sources: ["@fixture/kit/stories"],
  presets: [kitPreset()],
  id: "parity",
  a11y: false,
  componentDocs: false
});
