/**
 * The switches of a Kaji-like library, for the core's tests: the theme and the contrast, the library's motion, speed
 * and press feedback, and a language. The fixture catalogue declares the same (`fixtures/app/src/switches.ts`).
 *
 * @module
 */
import { catalogueSwitches, DEFAULT_SWITCHES, type ViewSwitch } from "../src/switches";

/** The library's motion, speed and press feedback, on its own attributes. */
const LIBRARY_SWITCHES: readonly ViewSwitch[] = [
  {
    id: "motion",
    label: "Motion",
    apply: { kind: "attribute", name: "data-motion-amount" },
    default: "system",
    values: [
      { value: "system", label: "System", isUnset: true },
      { value: "all", label: "All" },
      { value: "reduced", label: "Reduced" },
      { value: "off", label: "Off" }
    ]
  },
  {
    id: "speed",
    label: "Speed",
    apply: { kind: "attribute", name: "data-motion" },
    default: "normal",
    values: [
      { value: "slow", label: "Slow" },
      { value: "normal", label: "Normal", isUnset: true },
      { value: "fast", label: "Fast" }
    ]
  },
  {
    id: "press",
    label: "Press",
    apply: { kind: "attribute", name: "data-press" },
    default: "default",
    values: [
      { value: "default", label: "Default", isUnset: true },
      { value: "shrink", label: "Shrink" },
      { value: "darken", label: "Darken" }
    ]
  }
];

/** The catalogue's switches: the theme, the contrast, the library's three, and a pseudo language. */
export const FIXTURE_SWITCHES: readonly ViewSwitch[] = catalogueSwitches(
  [...DEFAULT_SWITCHES, ...LIBRARY_SWITCHES],
  [{ id: "pseudo", label: "Pseudo" }]
);
