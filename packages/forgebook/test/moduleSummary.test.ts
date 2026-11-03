/**
 * Tests for the summary a component page leads with: the first paragraph of the component file's `@module` comment.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { moduleSummaryOf } from "../src/vite/moduleSummary.ts";

describe("moduleSummaryOf", () => {
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
    expect(moduleSummaryOf(text)).toBe(
      "A button: a word that runs an action, or with `href` goes somewhere."
    );
  });

  it("stops at the first tag when the paragraph has no blank line after it", () => {
    expect(moduleSummaryOf("/**\n * A card.\n * @module\n */\nexport {};")).toBe("A card.");
  });

  it("is empty for a file that opens with another comment, or with none", () => {
    expect(moduleSummaryOf("/** A button. */\nexport const Button = () => null;")).toBe("");
    expect(moduleSummaryOf("// a line\nexport {};")).toBe("");
    expect(moduleSummaryOf("export {};")).toBe("");
    expect(moduleSummaryOf("/** Unclosed @module")).toBe("");
  });

  it("reads past a shebang with Windows line ends", () => {
    expect(moduleSummaryOf("#!/usr/bin/env node\r\n/**\r\n * A tool.\r\n *\r\n * @module\r\n */")).toBe(
      "A tool."
    );
  });

  it("reads past a shebang and blank lines", () => {
    expect(moduleSummaryOf("#!/usr/bin/env node\n\n/**\n * A tool.\n *\n * @module\n */")).toBe("A tool.");
  });
});
