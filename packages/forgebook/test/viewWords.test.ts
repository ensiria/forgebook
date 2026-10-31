/**
 * Tests for a view written as words: each word a value of one switch or a number for the width, the address's form kept
 * as it is, and a word no switch has or two share refused with what to write instead.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isStoryShotReport } from "../src/storyCheck.ts";
import type { ViewSwitch } from "../src/switches.ts";
import { viewQuery } from "../src/viewWords.ts";
import { FIXTURE_SWITCHES } from "./fixtureSwitches.ts";

describe("viewQuery", () => {
  it("turns words into the address's form, spaces or + between them, a number into the width", () => {
    expect(viewQuery("dark pseudo 360", FIXTURE_SWITCHES)).toEqual({
      query: "theme=dark&lang=pseudo&width=360"
    });
    expect(viewQuery("dark+more", FIXTURE_SWITCHES)).toEqual({ query: "theme=dark&contrast=more" });
    expect(viewQuery("", FIXTURE_SWITCHES)).toEqual({ query: "" });
  });

  it("keeps the address's form as it is", () => {
    expect(viewQuery("theme=dark&width=360", FIXTURE_SWITCHES)).toEqual({ query: "theme=dark&width=360" });
  });

  it("refuses a word no switch has, and one two switches share, saying what to write", () => {
    expect(viewQuery("purple", FIXTURE_SWITCHES)).toEqual({ error: 'No switch has the value "purple"' });
    const shared: ViewSwitch[] = [
      ...FIXTURE_SWITCHES,
      {
        id: "density",
        label: "Density",
        default: "normal",
        apply: { kind: "code" },
        values: [{ value: "normal", label: "Normal" }]
      }
    ];
    // "normal" is a value of the fixture's speed switch too
    expect(viewQuery("normal", shared)).toEqual({
      error: '"normal" is a value of speed and density: write speed=normal'
    });
  });
});

describe("isStoryShotReport", () => {
  it("takes a picture run's report, and refuses what is not one", () => {
    expect(
      isStoryShotReport({ schema: 1, shots: [{ storyId: "a", view: "", frame: "f", file: "/a.png" }] })
    ).toBe(true);
    expect(isStoryShotReport({ schema: 1, shots: [{ storyId: "a" }] })).toBe(false);
  });
});
