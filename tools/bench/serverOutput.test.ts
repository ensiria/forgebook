/**
 * Tests for what the harness keeps of a server's output: the first error's message and frames, and the last lines.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { emptyOutput, keepOutput, outputText } from "./serverOutput.ts";

describe("a server's kept output", () => {
  it("keeps the first error's message and frames, then the last lines, which a long stack would push out", () => {
    const kept = emptyOutput();
    keepOutput(kept, "storybook v9\ninfo starting\n");
    keepOutput(kept, "SyntaxError: Unexpected token in main.js\n    at frame 1\n");
    keepOutput(kept, `${Array.from({ length: 40 }, (_, index) => `    at frame ${index + 2}`).join("\n")}\n`);
    keepOutput(kept, "Broken build, fix the error above.\n");
    const text = outputText(kept);
    expect(text.startsWith("SyntaxError: Unexpected token in main.js /     at frame 1")).toBe(true);
    expect(text).toContain("…");
    expect(text.endsWith("Broken build, fix the error above.")).toBe(true);
    expect(text).not.toContain("info starting");
  });

  it("keeps the last lines alone when nothing names an error", () => {
    const kept = emptyOutput();
    keepOutput(kept, "one\ntwo\n");
    expect(outputText(kept)).toBe("one / two");
  });
});
