/**
 * The shell's style sheet keeps the digits it asks for: a `font` shorthand resets `font-variant-numeric`, so in one
 * block the digits come after it.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SHELL = readFileSync(join(import.meta.dirname, "..", "src", "shell", "shell.scss"), "utf8");

/**
 * The selectors of the blocks that declare `font-variant-numeric` before a `font` shorthand, which undoes it.
 *
 * @param scss - a style sheet.
 */
const digitsBeforeFont = (scss: string): string[] =>
  [...scss.matchAll(/([^{};]+)\{([^{}]*)\}/g)]
    .filter(([, , body = ""]) => {
      const digits = body.search(/(^|[;\s])font-variant-numeric\s*:/);
      const font = body.search(/(^|[;\s])font\s*:/);
      return digits !== -1 && font !== -1 && digits < font;
    })
    .map(([, selector = ""]) => selector.trim().split("\n").at(-1)?.trim() ?? "");

describe("the shell's style sheet", () => {
  it("finds digits written before the font shorthand in one block", () => {
    const scss =
      ".a { font-variant-numeric: tabular-nums; font: $x; } .b { font: $x; font-variant-numeric: tabular-nums; }";
    expect(digitsBeforeFont(scss)).toEqual([".a"]);
  });

  it("writes every tabular digit after the font shorthand that would reset it", () => {
    expect(digitsBeforeFont(SHELL)).toEqual([]);
  });
});
