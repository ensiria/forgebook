/**
 * The fixture kit's preset for Forgebook, as a library ships one (Kaji UI's `./forgebook`): the theme and the
 * contrast, the kit's motion, speed and press feedback, and its story groups, with their values and names, so a
 * catalogue that shows the kit gets its View menu and its groups with `presets: [kitPreset()]`.
 *
 * @module
 */

import { definePreset, type ForgebookPreset } from "forgebook";
import { contrastSwitch, themeSwitch, type ViewSwitch } from "forgebook/switches";

/** How much motion plays: the system's (no attribute), then from everything to nothing. */
const motionSwitch: ViewSwitch = {
  id: "motion",
  label: "Motion",
  apply: { kind: "attribute", name: "data-motion-amount" },
  default: "system",
  values: [
    { value: "system", label: "System", isUnset: true },
    { value: "all", label: "All" },
    { value: "feedback", label: "Feedback" },
    { value: "essential", label: "Essential" },
    { value: "reduced", label: "Reduced" },
    { value: "off", label: "Off" }
  ]
};

/** How fast motion plays; normal writes no attribute. */
const speedSwitch: ViewSwitch = {
  id: "speed",
  label: "Speed",
  apply: { kind: "attribute", name: "data-motion" },
  default: "normal",
  values: [
    { value: "slow", label: "Slow" },
    { value: "normal", label: "Normal", isUnset: true },
    { value: "fast", label: "Fast" }
  ]
};

/** What a held-down control does; the library's default writes no attribute. */
const pressSwitch: ViewSwitch = {
  id: "press",
  label: "Press",
  apply: { kind: "attribute", name: "data-press" },
  default: "default",
  values: [
    { value: "default", label: "Default", isUnset: true },
    { value: "shrink", label: "Shrink" },
    { value: "darken", label: "Darken" },
    { value: "darkenWithoutHover", label: "Darken, no hover" },
    { value: "off", label: "Off" }
  ]
};

/**
 * The kit's preset.
 *
 * @returns the preset, for a catalogue's `presets`.
 */
export const kitPreset = (): ForgebookPreset =>
  definePreset({
    name: "fixture-kit",
    switches: [themeSwitch(), contrastSwitch(), motionSwitch, speedSwitch, pressSwitch],
    // the kinds of story a component's page has, in their order
    storyGroups: [
      { id: "states", label: "States" },
      { id: "motion", label: "Motion" },
      { id: "in-context", label: "In context" },
      { id: "showcase", label: "Showcase" },
      { id: "worst-case", label: "Worst cases" },
      { id: "behaviour", label: "Behaviour" }
    ]
  });
