/**
 * A catalogue that wears a library's look throughout: every role of the theme in both appearances, its own fonts and
 * corners, no logo and Forgebook's branding off. The shell's browser tests read what is left of Forgebook's look on it.
 *
 * @module
 */
import { kitPreset } from "@fixture/kit/forgebook";
import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Ember UI",
  sources: ["@fixture/kit/stories"],
  presets: [kitPreset()],
  id: "white-label",
  shell: {
    branding: false,
    theme: {
      light: {
        window: "#fbf4ea",
        sidebar: "#f3e6d4",
        surface: "#fffaf3",
        separator: "#4a2c1124",
        hover: "#4a2c110f",
        text: "#2c1a0b",
        "text-secondary": "#5f4630",
        "text-tertiary": "#6f5540",
        accent: "#b4380f",
        "accent-text": "#9a2f0b",
        "danger-text": "#a1122e",
        "code-keyword": "#7a2a8c",
        "code-type": "#9a2f0b",
        "code-string": "#2f6b1f",
        "code-number": "#8a4b00",
        "code-punctuation": "#6f5540",
        "code-name": "#2c1a0b"
      },
      dark: {
        window: "#1a120c",
        sidebar: "#231810",
        surface: "#2c1f15",
        separator: "#f6e7d51f",
        hover: "#f6e7d514",
        text: "#f6e7d5",
        "text-secondary": "#d4bfa8",
        "text-tertiary": "#bfa88f",
        accent: "#f07a3e",
        "accent-text": "#ffa877",
        "danger-text": "#ff9aa8",
        "code-keyword": "#e0a8ef",
        "code-type": "#ffa877",
        "code-string": "#a8dc8f",
        "code-number": "#f2c06b",
        "code-punctuation": "#bfa88f",
        "code-name": "#f6e7d5"
      },
      fonts: { sans: 'Georgia, "Times New Roman", serif', mono: '"Courier New", monospace' },
      radius: { control: "2px", card: "4px" }
    }
  }
});
