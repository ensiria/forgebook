/**
 * Tests for Forgebook's mark: the shell's drawing and the READMEs' file are the same, and the shell's is an image's
 * address.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FORGEBOOK_MARK_SVG, FORGEBOOK_MARK_URL } from "../src/shell/forgebookMark.ts";

/** The READMEs' copy, at the repository's root. */
const README_MARK = join(import.meta.dirname, "..", "..", "..", "assets", "forgebook-logo.svg");

describe("Forgebook's mark", () => {
  it("draws the same in the shell and in the READMEs, which only add a size", () => {
    const file = readFileSync(README_MARK, "utf8").trim().replace(' width="128" height="128"', "");
    expect(file).toBe(FORGEBOOK_MARK_SVG);
  });

  it("is an SVG image's address", () => {
    expect(decodeURIComponent(FORGEBOOK_MARK_URL.replace("data:image/svg+xml,", ""))).toBe(
      FORGEBOOK_MARK_SVG
    );
  });
});
