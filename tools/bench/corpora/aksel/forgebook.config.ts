/**
 * Aksel's catalogue for the benchmark: its own stories and its own Storybook preview.
 *
 * @remarks
 * Its `.storybook/main.ts` adds nothing to Vite that a story needs in development: the paths of its `tsconfig.json`,
 * which declares none, and a minifier and a plugin for its production build. Its preview is written with
 * `definePreview`, read through `forgebook.preview.tsx` beside this file.
 *
 * @module
 */
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Aksel",
  stories: ["../@navikt/**/*.stories.@(js|jsx|ts|tsx)"]
});
