/**
 * The process table read on each system, and a tree's memory summed from it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { parsePsRows, parseWindowsRows, treeMemory } from "./processes.ts";

describe("parsePsRows", () => {
  it("reads ps's columns, its memory in kilobytes", () => {
    expect(parsePsRows("  10   1  2048\n  11  10   512\n")).toEqual([
      { pid: 10, parent: 1, memory: 2_097_152 },
      { pid: 11, parent: 10, memory: 524_288 }
    ]);
  });
});

describe("parseWindowsRows", () => {
  it("reads a tick's entries, in bytes, past an empty one", () => {
    expect(parseWindowsRows("0 0 8192;4 0 1000;;4420 4 2000000")).toEqual([
      { pid: 0, parent: 0, memory: 8192 },
      { pid: 4, parent: 0, memory: 1000 },
      { pid: 4420, parent: 4, memory: 2_000_000 }
    ]);
  });
});

describe("treeMemory", () => {
  const rows = [
    { pid: 0, parent: 0, memory: 1 },
    { pid: 100, parent: 0, memory: 10 },
    { pid: 200, parent: 100, memory: 20 },
    { pid: 300, parent: 200, memory: 30 },
    { pid: 400, parent: 0, memory: 40 }
  ];

  it("sums a process and everything below it, and nothing beside it", () => {
    expect(treeMemory(rows, 100)).toBe(60);
  });

  it("does not take a process that is its own parent for a child of the root", () => {
    expect(treeMemory(rows, 0)).toBe(101);
  });
});
