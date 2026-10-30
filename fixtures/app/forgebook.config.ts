/**
 * The fixture catalogue: Forgebook over the fixture kit, drawn with React, with the kit's preset (its switches) and
 * two languages. The shell's browser tests run on it (`shell/`).
 *
 * @module
 */
import { kitPreset } from "@fixture/kit/forgebook";
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Fixture catalogue",
  logo: "logo.svg",
  // invented heights, so the tests can see a story's box wait at its measured height
  heights: "story-heights.json",
  sources: ["@fixture/kit/stories"],
  languages: [
    { id: "it", label: "Italiano" },
    { id: "pseudo", label: "Pseudo", isPseudo: true }
  ],
  presets: [kitPreset()]
});
