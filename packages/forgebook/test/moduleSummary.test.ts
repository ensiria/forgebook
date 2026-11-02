/**
 * Tests for the summary a component page leads with: the first paragraph of the component file's `@module` comment.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { moduleSummaryOfText } from "../src/vite/moduleSummary.ts";

describe("moduleSummaryOfText", () => {
  it("takes the first paragraph of the module comment, on one line", () => {
    const text = `/**
 * A button: a word that runs an action,
 * or with \`href\` goes somewhere.
 *
 * @remarks
 * Published.
 *
 * @module
 */
export const Button = () => null;`;
    expect(moduleSummaryOfText(text)).toBe(
      "A button: a word that runs an action, or with `href` goes somewhere."
    );
  });

  it("stops at the first tag when the paragraph has no blank line after it", () => {
    expect(moduleSummaryOfText("/**\n * A card.\n * @module\n */\nexport {};")).toBe("A card.");
  });

  it("is empty for a file that opens with another comment, or with none", () => {
    expect(moduleSummaryOfText("/** A button. */\nexport const Button = () => null;")).toBe("");
    expect(moduleSummaryOfText("// a line\nexport {};")).toBe("");
    expect(moduleSummaryOfText("export {};")).toBe("");
  });
});
