/**
 * Tests for the summary a component page leads with: the first paragraph of the component file's `@module` comment.
 *
 * @module
 */
import ts from "typescript-6";
import { describe, expect, it } from "vitest";

import { moduleSummaryOf } from "../src/vite/docsProgram.ts";

/** A file with this text. */
const fileOf = (text: string): ts.SourceFile =>
  ts.createSourceFile("Button.tsx", text, ts.ScriptTarget.Latest);

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
    expect(moduleSummaryOf(fileOf(text))).toBe(
      "A button: a word that runs an action, or with `href` goes somewhere."
    );
  });

  it("stops at the first tag when the paragraph has no blank line after it", () => {
    expect(moduleSummaryOf(fileOf("/**\n * A card.\n * @module\n */\nexport {};"))).toBe("A card.");
  });

  it("is empty for a file that opens with another comment, or with none", () => {
    expect(moduleSummaryOf(fileOf("/** A button. */\nexport const Button = () => null;"))).toBe("");
    expect(moduleSummaryOf(fileOf("// a line\nexport {};"))).toBe("");
    expect(moduleSummaryOf(fileOf("export {};"))).toBe("");
  });
});
