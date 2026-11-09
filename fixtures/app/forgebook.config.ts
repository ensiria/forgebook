/**
 * The fixture catalogue: Forgebook over the fixture kit and the Storybook fixture, drawn with React, with the kit's
 * preset (its switches) and two languages. The shell's browser tests run on it (`shell/`).
 *
 * @module
 */
import { kitPreset } from "@fixture/kit/forgebook";
import { probePlugin } from "@fixture/storybook/plugin";
import { figma } from "@forgebook/plugin-figma";
import { msw } from "@forgebook/plugin-msw";
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
    { id: "pseudo", label: "Pseudo", isPseudo: true },
    // read right to left, with no texts of its own: it draws the stories right to left, in English
    { id: "ar", label: "العربية", dir: "rtl" }
  ],
  // the probe, a plugin that touches every place the plugin API offers, comes from a preset, as a library's would
  presets: [kitPreset(), { name: "probe", plugins: [probePlugin()] }],
  // the two plugins Forgebook ships
  plugins: [figma(), msw()],
  // lists of its own, so the shell's tests see each set by a catalogue
  id: "fixture",
  widths: [{ width: 360 }, { width: 412, label: "Phone L" }, { width: 560 }, { width: 768 }, { width: 1024 }],
  backgrounds: { custom: [{ id: "paper", label: "Paper", light: { color: "#f5efe0" } }] },
  strings: { "tabs.parts": "Parts and hooks" },
  gridStep: 4,
  // a theme of the shell, so its tests see it reach the page and stay out of the frames
  shell: {
    theme: { light: { "accent-text": "#5a2aa0" }, dark: { accent: "#b28bff" }, radius: { card: "10px" } }
  },
  // invented tokens, so a designer's page has some to show
  tokens: ["tokens.json", { file: "tokens.dark.json", mode: "dark" }],
  // custom controls, one that works and one for each way one can fail, so the shell's tests see them all
  argControls: {
    rating: "./controls/rating.tsx",
    failing: "./controls/failing.ts",
    gone: "./controls/gone.ts",
    unschemed: "./controls/unschemed.ts",
    wrongValue: "./controls/wrongValue.ts"
  },
  // a view offered to every reader, so the shell's tests pick one the catalogue declares
  views: [{ name: "Dark phone", view: "theme=dark&width=360" }]
});
