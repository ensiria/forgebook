/**
 * The dry-run stand-in's script: read, applied, and refused when it drifted from its app; and every task's scripts read.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyEdit, parseScript } from "./dryRunScript.ts";

const TASKS = join(import.meta.dirname, "..", "tasks");

describe("a dry-run script", () => {
  it("replaces a text once, or writes a file", () => {
    expect(applyEdit("a b c", { file: "x", find: "b", replace: "B" })).toBe("a B c");
    expect(applyEdit(undefined, { file: "x", write: "new" })).toBe("new");
  });

  it("fails when the text is missing or there twice", () => {
    expect(() => applyEdit("a", { file: "x", find: "b", replace: "c" })).toThrow(/not there/);
    expect(() => applyEdit("b b", { file: "x", find: "b", replace: "c" })).toThrow(/twice/);
    expect(() => applyEdit(undefined, { file: "x", find: "b", replace: "c" })).toThrow(/not there/);
  });

  it("refuses a file outside the project", () => {
    expect(() => parseScript(JSON.stringify({ say: "", edits: [{ file: "../x", write: "" }] }))).toThrow(
      /inside/
    );
  });

  it("reads for every task that has one", () => {
    for (const task of readdirSync(TASKS)) {
      for (const arm of ["with", "without"]) {
        const file = join(TASKS, task, "dry-run", `${arm}.json`);
        if (existsSync(file)) expect(parseScript(readFileSync(file, "utf8")).edits.length).toBeGreaterThan(0);
      }
    }
  });
});
