/**
 * The fixture catalogue: Forgebook over the fixture kit and the Storybook fixture, drawn with React, with the kit's
 * preset (its switches) and two languages. The shell's browser tests run on it (`shell/`).
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
  // the kit's stories, and stories written the Storybook way, each file one Storybook feature Forgebook reads
  sources: ["@fixture/kit/stories", "@fixture/storybook/stories"],
  languages: [
    { id: "it", label: "Italiano" },
    { id: "pseudo", label: "Pseudo", isPseudo: true }
  ],
  presets: [kitPreset()],
  // lists of its own, so the shell's tests see each set by a catalogue
  id: "fixture",
  widths: [{ width: 360 }, { width: 412, label: "Phone L" }, { width: 560 }, { width: 768 }, { width: 1024 }],
  backgrounds: { custom: [{ id: "paper", label: "Paper", light: { color: "#f5efe0" } }] },
  strings: { "tabs.parts": "Parts and hooks" },
  gridStep: 4
});
