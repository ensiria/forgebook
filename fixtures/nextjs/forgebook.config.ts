/**
 * The Next.js fixture's catalogue: the app's components and their stories, drawn as the app draws them. Google fonts
 * are not downloaded, so the shell's tests never reach the network: Inter shows as its fallback.
 *
 * @module
 */
import { nextjs } from "@forgebook/nextjs/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: nextjs({ googleFonts: "none" }),
  title: "Harbour",
  stories: ["components/**/*.stories.tsx"]
});
