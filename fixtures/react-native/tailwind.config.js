/**
 * Tailwind's configuration for NativeWind: the classes the components use, with NativeWind's preset.
 *
 * @module
 */
import nativewind from "nativewind/preset";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [nativewind],
  // the catalogue's theme switch sets `dark` on the frame's root (forgebook.config.ts), which `dark:` classes follow
  darkMode: "class",
  theme: { extend: { colors: { harbour: "#2a6f97", foam: "#e8f3fa" } } }
};
