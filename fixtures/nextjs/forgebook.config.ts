/**
 * The Next.js fixture's catalogue: the app's components and their stories, drawn as the app draws them. Google fonts
 * are not downloaded, so the shell's tests never reach the network: Inter shows as its fallback. Its drafts' stories
 * are left out with a `!` pattern, which the shell's tests check.
 *
 * @module
 */
import { nextjs } from "@forgebook/nextjs/vite";
import { msw } from "@forgebook/plugin-msw";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: nextjs({ googleFonts: "none" }),
  title: "Harbour",
  plugins: [msw()],
  // the drafts' stories are left out, whatever pattern lists them
  stories: ["components/**/*.stories.tsx", "!components/drafts/**"]
});
