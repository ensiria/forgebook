/**
 * Tests for the answers kept on disk between starts: a kept answer holds only while every file it depends on does.
 *
 * @module
 */
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { diskCache } from "../src/vite/diskCache.ts";

const folder = mkdtempSync(join(tmpdir(), "forgebook-cache-"));
const isText = (value: unknown): value is string => typeof value === "string";

describe("diskCache", () => {
  afterAll(() => rmSync(folder, { recursive: true }));
  const source = join(folder, "source.ts");
  const cache = diskCache(join(folder, "kept"), "one", isText);

  it("answers until a file it depends on changes", () => {
    writeFileSync(source, "a");
    cache.write(source, "answer", [source]);
    expect(cache.read(source)).toBe("answer");
    utimesSync(source, new Date(1_000), new Date(1_000));
    expect(cache.read(source)).toBeUndefined();
  });

  it("notices a file that did not exist and now does", () => {
    const missing = join(folder, "later.ts");
    cache.write(source, "answer", [missing]);
    expect(cache.read(source)).toBe("answer");
    writeFileSync(missing, "a");
    expect(cache.read(source)).toBeUndefined();
  });

  it("misses what another build wrote, or a value of another shape", () => {
    cache.write(source, "answer", [source]);
    expect(diskCache(join(folder, "kept"), "two", isText).read(source)).toBeUndefined();
    const isNumber = (value: unknown): value is number => typeof value === "number";
    expect(diskCache(join(folder, "kept"), "one", isNumber).read(source)).toBeUndefined();
  });

  it("is only a miss when its folder cannot be written", () => {
    const blocked = diskCache(join(source, "kept"), "one", isText);
    expect(() => blocked.write(source, "answer", [source])).not.toThrow();
    expect(blocked.read(source)).toBeUndefined();
  });
});
