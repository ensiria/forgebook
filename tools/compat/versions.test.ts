/**
 * The version rules: ordering as npm orders, caret ranges read into lines, and any other range refused.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { caretClauses, compareVersions, isPrerelease, newestInClause, parseVersion } from "./versions.ts";

describe("parseVersion", () => {
  it("reads a release, a prerelease and build metadata", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseVersion("2.0.0-rc.21")).toEqual({ major: 2, minor: 0, patch: 0, prerelease: ["rc", 21] });
    expect(parseVersion("1.0.0+build.5")?.prerelease).toEqual([]);
  });

  it("refuses what is not a version", () => {
    expect(parseVersion("^1.2.3")).toBeUndefined();
    expect(parseVersion("1.2")).toBeUndefined();
  });
});

describe("compareVersions", () => {
  it("orders as npm does", () => {
    const sorted = [
      "1.0.0",
      "1.0.0-rc.1",
      "1.0.0-beta.11",
      "1.0.0-beta.2",
      "0.9.9",
      "1.0.1",
      "1.0.0-alpha"
    ].sort(compareVersions);
    expect(sorted).toEqual([
      "0.9.9",
      "1.0.0-alpha",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1"
    ]);
  });

  it("puts a canary of a release before the release", () => {
    expect(compareVersions("19.3.0-canary-5b610964-20261106", "19.3.1")).toBeLessThan(0);
    expect(isPrerelease("19.3.0-canary-5b610964-20261106")).toBe(true);
  });
});

describe("caretClauses", () => {
  it("reads each caret of a range into its line", () => {
    expect(caretClauses("^18.2.0 || ^19.0.0").map((clause) => clause.line)).toEqual(["18", "19"]);
    expect(caretClauses("^0.21.0")).toEqual([{ lower: "0.21.0", upper: "0.22.0", line: "0.21" }]);
    expect(caretClauses("^5")).toEqual([{ lower: "5.0.0", upper: "6.0.0", line: "5" }]);
  });

  it("reads a caret below 1.0 as npm does", () => {
    expect(caretClauses("^0.0.3")).toEqual([{ lower: "0.0.3", upper: "0.0.4", line: "0.0.3" }]);
    expect(caretClauses("^0.0")).toEqual([{ lower: "0.0.0", upper: "0.1.0", line: "0.0" }]);
    expect(caretClauses("^0")).toEqual([{ lower: "0.0.0", upper: "1.0.0", line: "0" }]);
  });

  it("refuses any other kind of range, so none is read wrong", () => {
    expect(() => caretClauses(">=0.76.0 <1.0.0")).toThrow("not a caret");
    expect(() => caretClauses("^1.0.0 || ~2.1.0")).toThrow("~2.1.0");
  });
});

describe("newestInClause", () => {
  it("takes the newest release inside the clause and never a prerelease", () => {
    const [clause] = caretClauses("^10.19.0");
    if (clause === undefined) throw new Error("no clause");
    expect(newestInClause(["10.18.0", "10.19.2", "10.29.8", "10.30.0-rc.1", "11.0.0"], clause)).toBe(
      "10.29.8"
    );
    expect(newestInClause(["10.1.0"], clause)).toBeUndefined();
  });
});
