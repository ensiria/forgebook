/**
 * The two ways a folder's size is counted.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contentSize, diskUsage } from "./diskUsage.ts";

const folder = (): string => {
  const root = mkdtempSync(join(tmpdir(), "bench-size-"));
  mkdirSync(join(root, "inner"));
  writeFileSync(join(root, "a.txt"), "x".repeat(100));
  writeFileSync(join(root, "inner", "b.txt"), "x".repeat(50));
  return root;
};

describe("contentSize", () => {
  it("adds the files' bytes, through the folders", async () => {
    expect(await contentSize(folder())).toBe(150);
  });
});

describe("diskUsage", () => {
  it("counts whole blocks, so a file takes more than its bytes", async () => {
    // a few kilobytes and not a few bytes: NTFS keeps a file of a few hundred bytes in its file table, with no block
    const root = mkdtempSync(join(tmpdir(), "bench-blocks-"));
    writeFileSync(join(root, "a.txt"), "x".repeat(5000));
    expect(await diskUsage(root)).toBeGreaterThan(5000);
  });
});
