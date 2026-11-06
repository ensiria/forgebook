/**
 * A catalogue of a library with several visual themes: its Theme switch is a gallery of pictures and swatches, one look
 * is drawn only for dark and implies it, two have a style sheet of their own, and light and dark are named Appearance.
 * The shell's browser tests read the gallery on it (`shell/gallery.e2e.ts`).
 *
 * @module
 */
import { kitPreset } from "@fixture/kit/forgebook";
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";
import { contrastSwitch, themeSwitch } from "forgebook/switches";

export default defineConfig({
  framework: react(),
  title: "Themed catalogue",
  sources: ["@fixture/kit/stories"],
  presets: [kitPreset()],
  id: "themes",
  switches: [
    { ...themeSwitch(), label: "Appearance" },
    contrastSwitch(),
    {
      id: "look",
      label: "Theme",
      control: "gallery",
      apply: { kind: "attribute", name: "data-look" },
      default: "plain",
      values: [
        { value: "plain", label: "Plain", isUnset: true },
        // a picture smaller than Vite's limit for inlining: it must stay a file, out of the first load
        { value: "paper", label: "Paper", preview: { image: "looks/paper.png" }, sheet: "looks/paper.css" },
        {
          value: "night",
          label: "Night",
          preview: { swatches: ["#0b1020", "#1c2541", "#7c8cff", "#f2f4ff"], font: "Harbor Sans" },
          implies: { theme: "dark" },
          sheet: "looks/night.css"
        },
        { value: "meadow", label: "Meadow", preview: { image: "looks/meadow.svg" } },
        // no preview: it must still read well
        { value: "harbour-at-first-light", label: "Harbour at first light" }
      ]
    }
  ],
  toolbar: ["theme", "look"]
});
