/**
 * The fixture catalogue's switches: the theme and the contrast, and the motion, speed and press feedback of a
 * Kaji-like library, with today's values and names, so the shell's tests see the View menu a library's preset gives.
 *
 * @module
 */
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

/** The switches the shell and the frame pages declare. */
export const SWITCHES: readonly ViewSwitch[] = [
  themeSwitch(),
  contrastSwitch(),
  motionSwitch,
  speedSwitch,
  pressSwitch
];
