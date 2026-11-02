/**
 * Tests for which palette the shell draws in: the reader's choice, and following the story.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { offeredAppearances, shellIsDark } from "../src/shell/shellScheme.ts";
import { themeSwitch } from "../src/switches.ts";

const SWITCHES = [themeSwitch()];

/** The question, with a light system and no comparison unless a test says so. */
const isDark = (
  appearance: Parameters<typeof shellIsDark>[0]["appearance"],
  theme: string | undefined,
  overrides: { readonly isSystemDark?: boolean; readonly isComparing?: boolean } = {}
): boolean =>
  shellIsDark({
    appearance,
    values: theme === undefined ? {} : { theme },
    switches: SWITCHES,
    isSystemDark: overrides.isSystemDark ?? false,
    isComparing: overrides.isComparing ?? false
  });

describe("shellIsDark", () => {
  it("keeps the reader's choice, whatever the story shows", () => {
    expect(isDark("light", "dark")).toBe(false);
    expect(isDark("dark", "light")).toBe(true);
  });

  it("follows the system when asked", () => {
    expect(isDark("system", "dark", { isSystemDark: true })).toBe(true);
    expect(isDark("system", "dark", { isSystemDark: false })).toBe(false);
  });

  it("follows the story's colour scheme", () => {
    expect(isDark("story", "dark")).toBe(true);
    expect(isDark("story", "light", { isSystemDark: true })).toBe(false);
  });

  it("follows the system when the story itself does", () => {
    expect(isDark("story", "system", { isSystemDark: true })).toBe(true);
  });

  it("stays on the system while comparing: several themes at once have no one to follow", () => {
    expect(isDark("story", "dark", { isComparing: true })).toBe(false);
  });

  it("uses the switch's default when the view has no value", () => {
    expect(isDark("story", undefined)).toBe(false);
  });

  it("falls back to the system in a catalogue with no theme switch", () => {
    expect(
      shellIsDark({ appearance: "story", values: {}, switches: [], isSystemDark: true, isComparing: false })
    ).toBe(true);
  });
});

describe("offeredAppearances", () => {
  it("offers following the story only when a story has a scheme to follow", () => {
    expect(offeredAppearances(SWITCHES)).toEqual(["light", "dark", "system", "story"]);
    expect(offeredAppearances([])).toEqual(["light", "dark", "system"]);
  });
});
