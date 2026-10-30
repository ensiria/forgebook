/**
 * Tests for the docs' programs: one kept and read again while nothing changes, renewed after a change.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { markSourcesChanged, programFor } from "../src/vite/docsProgram";

const SELECT = join(import.meta.dirname, "fixtures", "kit", "src", "Select.tsx");

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
