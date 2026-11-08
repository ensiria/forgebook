/**
 * The JSON readers: a cell's versions must be exact, since they go into pnpm's overrides; a result must carry a known
 * status; the registry's answer must list versions.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { parseCell, parsePlannedCell, parseRegistry } from "./documents.ts";

const PLANNED = {
  id: "forgebook-preact-preact-10",
  adapter: "@forgebook/preact",
  host: "preact",
  range: "^10.19.0 || ^11.0.0",
  line: "10",
  version: "10.29.8",
  packages: { preact: "10.29.8" }
};

describe("parsePlannedCell", () => {
  it("reads a cell as the plan writes it", () => {
    expect(parsePlannedCell(PLANNED, "cell")).toEqual(PLANNED);
  });

  it("refuses a version that is not exact: a range, a tag, an alias or a URL would reach pnpm's overrides", () => {
    for (const version of ["^10.0.0", "latest", "npm:other@1.0.0", "https://example.com/p.tgz"]) {
      expect(() => parsePlannedCell({ ...PLANNED, version }, "cell")).toThrow("not an exact version");
      expect(() => parsePlannedCell({ ...PLANNED, packages: { preact: version } }, "cell")).toThrow(
        "cell.packages.preact is not an exact version"
      );
    }
  });
});

describe("parseCell", () => {
  it("refuses a status it does not know", () => {
    const result = { ...PLANNED, status: "skipped", installed: {}, commands: [], node: "24.11.0" };
    expect(() => parseCell(result, "result")).toThrow("result.status is not one of passed, failed, not-run");
  });
});

describe("parseRegistry", () => {
  it("keeps the versions and the dist-tags, and refuses an answer with no versions", () => {
    expect(parseRegistry({ versions: { "1.0.0": {} }, "dist-tags": { latest: "1.0.0" } }, "p")).toEqual({
      versions: ["1.0.0"],
      distTags: { latest: "1.0.0" }
    });
    expect(() => parseRegistry({ error: "not found" }, "p")).toThrow(
      "the registry's answer for p has no versions"
    );
  });
});
