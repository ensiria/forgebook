/**
 * Tests for the docs' programs: one kept and read again while nothing changes, renewed after a change.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { markSourcesChanged, programFor } from "../src/vite/docsProgram.ts";
import { KIT_DIR } from "./fixturePaths.ts";

const SELECT = join(KIT_DIR, "src", "Select.tsx");

describe("programFor", () => {
  it("reads the same program again while no source changed, and a new one after a change", () => {
    const first = programFor(SELECT);
    const again = programFor(SELECT);
    if (typeof first === "string" || typeof again === "string") throw new Error("no program");
    expect(again.program).toBe(first.program);
    expect(again.checker).toBe(first.checker);
    markSourcesChanged();
    const renewed = programFor(SELECT);
    if (typeof renewed === "string") throw new Error("no program");
    expect(renewed.program).not.toBe(first.program);
  }, 60_000);
});

describe("files no configuration holds", () => {
  const folder = (): string => mkdtempSync(join(tmpdir(), "forgebook-loose-"));

  it("share one program, or a project with no tsconfig.json keeps a compiler per story file", () => {
    const root = folder();
    const [first, second] = [join(root, "a.stories.jsx"), join(root, "b.stories.jsx")];
    writeFileSync(first, "export const a = 1;\n");
    writeFileSync(second, "export const b = 2;\n");
    const one = programFor(first);
    const two = programFor(second);
    if (typeof one === "string" || typeof two === "string") throw new Error("no program");
    expect(one.program.getSourceFile(second)).toBeDefined();
    expect(two.program).toBe(one.program);
  });

  it("finds a file written after the program was made", () => {
    const root = folder();
    const first = join(root, "a.stories.jsx");
    writeFileSync(first, "export const a = 1;\n");
    expect(typeof programFor(first)).not.toBe("string");
    const later = join(root, "b.stories.jsx");
    writeFileSync(later, "export const b = 2;\n");
    const found = programFor(later);
    if (typeof found === "string") throw new Error("no program");
    expect(found.program.getSourceFile(later)).toBeDefined();
  });
});
