/**
 * The statuses: the defaults filled in, what a configuration may declare, how presets and a catalogue merge, and which
 * statuses a list of tags holds.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { catalogueStatuses, mergedStatuses, statusesOf, statusesProblem } from "../src/storyStatuses.ts";

describe("catalogueStatuses", () => {
  it("has three by default, in their order", () => {
    expect(catalogueStatuses()).toEqual([
      { id: "review", tone: "caution" },
      { id: "experimental", tone: "info" },
      { id: "deprecated", tone: "critical" }
    ]);
  });

  it("restyles or renames a default field by field, adds the catalogue's own and turns one off", () => {
    expect(
      catalogueStatuses({
        review: { label: "In review" },
        experimental: false,
        beta: { label: "Beta", tone: "positive" },
        legacy: {}
      })
    ).toEqual([
      { id: "review", tone: "caution", label: "In review" },
      { id: "deprecated", tone: "critical" },
      { id: "beta", tone: "positive", label: "Beta" },
      { id: "legacy", tone: "neutral" }
    ]);
  });
});

describe("statusesOf", () => {
  it("keeps the statuses the tags hold, in the catalogue's order, and nothing of a !name", () => {
    const statuses = catalogueStatuses();
    expect(statusesOf(["deprecated", "beta", "review"], statuses).map((each) => each.id)).toEqual([
      "review",
      "deprecated"
    ]);
    expect(statusesOf(["!review", "autodocs"], statuses)).toEqual([]);
  });
});

describe("mergedStatuses", () => {
  it("merges status by status and field by field, false turning one off until a later list declares it", () => {
    expect(
      mergedStatuses([
        { review: { tone: "info" }, legacy: { label: "Old" } },
        undefined,
        { review: { label: "In review" }, legacy: false, experimental: false },
        { experimental: { label: "Lab" } }
      ])
    ).toEqual({
      statuses: {
        review: { tone: "info", label: "In review" },
        legacy: false,
        experimental: { label: "Lab" }
      }
    });
  });

  it("gives nothing when none declares any, so a catalogue's page carries no bytes for them", () => {
    expect(mergedStatuses([undefined, {}])).toEqual({});
  });
});

describe("statusesProblem", () => {
  it("accepts what a configuration may write", () => {
    expect(statusesProblem(undefined)).toBeUndefined();
    expect(
      statusesProblem({ review: false, beta: { label: "Beta", tone: "positive" }, x: {} })
    ).toBeUndefined();
  });

  it("names what it may not", () => {
    expect(statusesProblem(["review"])).toMatch(/object of statuses/);
    expect(statusesProblem({ test: {} })).toMatch(/"test" cannot be a status/);
    expect(statusesProblem({ "!review": {} })).toMatch(/cannot be a status/);
    expect(statusesProblem({ review: true })).toMatch(/must be \{ label, tone \} or false/);
    expect(statusesProblem({ review: { label: "" } })).toMatch(/label that is no text/);
    expect(statusesProblem({ review: { tone: "red" } })).toMatch(/tone "red": write one of neutral, info/);
    expect(statusesProblem({ review: [] })).toMatch(/must be \{ label, tone \} or false/);
    expect(statusesProblem({ review: { colour: "caution" } })).toMatch(/no field "colour"/);
  });
});
