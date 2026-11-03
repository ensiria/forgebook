/**
 * Tests for what is kept on disk between starts: an answer holds while everything it was made from is unchanged, and
 * any change, a file added beside one it read included, is a miss.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  codeStamp,
  diskCache,
  isSettledSince,
  nowNs,
  SETTLE_MARGIN_NS,
  stampPaths
} from "../src/vite/diskCache.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-disk-cache-"));

/** Whether a value is a text: what these caches keep. */
const isText = (value: unknown): value is string => typeof value === "string";

/** A folder of its own, with a file in it. */
const fileIn = (name: string): string => {
  mkdirSync(join(ROOT, name), { recursive: true });
  const file = join(ROOT, name, "a.ts");
  writeFileSync(file, "export const a = 1;\n");
  return file;
};

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("diskCache", () => {
  it("answers what was kept while its files are as they were", () => {
    const file = fileIn("fresh");
    const cache = diskCache(join(ROOT, "cache-fresh"), "code", isText);
    expect(cache.read("key")).toBeUndefined();
    expect(cache.isEmpty()).toBe(true);
    cache.write("key", "answer", stampPaths([file]));
    expect(cache.read("key")).toBe("answer");
    expect(cache.isEmpty()).toBe(false);
  });

  it("misses after an edit, even one that kept the modification time", () => {
    const file = fileIn("edited");
    const cache = diskCache(join(ROOT, "cache-edited"), "code", isText);
    cache.write("key", "answer", stampPaths([file]));
    const before = statSync(file);
    writeFileSync(file, "export const a = 2;\n");
    utimesSync(file, before.atime, before.mtime);
    expect(cache.read("key")).toBeUndefined();
  });

  it("misses when a file appears beside one it read, which an import may now find", () => {
    const file = fileIn("shadowed");
    const cache = diskCache(join(ROOT, "cache-shadowed"), "code", isText);
    cache.write("key", "answer", stampPaths([file, join(ROOT, "shadowed")]));
    writeFileSync(join(ROOT, "shadowed", "a.tsx"), "export const a = 3;\n");
    expect(cache.read("key")).toBeUndefined();
  });

  it("misses when a file it found missing is there", () => {
    const missing = join(ROOT, "appearing", "later.ts");
    mkdirSync(join(ROOT, "appearing"), { recursive: true });
    const cache = diskCache(join(ROOT, "cache-appearing"), "code", isText);
    cache.write("key", "answer", stampPaths([missing]));
    expect(cache.read("key")).toBe("answer");
    writeFileSync(missing, "export {};\n");
    expect(cache.read("key")).toBeUndefined();
  });

  it("misses what other code wrote, and what is no answer", () => {
    const file = fileIn("coded");
    diskCache(join(ROOT, "cache-coded"), "old", isText).write("key", "answer", stampPaths([file]));
    expect(diskCache(join(ROOT, "cache-coded"), "new", isText).read("key")).toBeUndefined();
    diskCache(
      join(ROOT, "cache-coded"),
      "code",
      (value: unknown): value is number => typeof value === "number"
    ).write("number", 1, stampPaths([file]));
    expect(diskCache(join(ROOT, "cache-coded"), "code", isText).read("number")).toBeUndefined();
  });
});

describe("stamps", () => {
  it("keep a folder whose files were saved in place, as an editor's safe write does", () => {
    const file = fileIn("saved");
    const cache = diskCache(join(ROOT, "cache-saved"), "code", isText);
    cache.write("key", "answer", stampPaths([join(ROOT, "saved")]));
    writeFileSync(`${file}.tmp`, "export const a = 5;\n");
    renameSync(`${file}.tmp`, file);
    expect(cache.read("key")).toBe("answer");
  });

  it("tell an answer made across an edit, which is not kept", () => {
    const file = fileIn("settled");
    const before = nowNs();
    writeFileSync(file, "export const a = 6;\n");
    expect(isSettledSince(stampPaths([file]), before)).toBe(false);
    expect(isSettledSince(stampPaths([file]), nowNs() + SETTLE_MARGIN_NS + 60_000_000_000n)).toBe(true);
  });
});

describe("codeStamp", () => {
  it("changes with an edit of the code's folders, and only then", () => {
    const file = fileIn("code");
    const stamp = codeStamp([join(ROOT, "code")]);
    expect(codeStamp([join(ROOT, "code")])).toBe(stamp);
    writeFileSync(file, "export const a = 4;\n");
    expect(codeStamp([join(ROOT, "code")])).not.toBe(stamp);
  });
});
