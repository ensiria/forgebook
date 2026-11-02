/**
 * Tests for where a catalogue's caches go: the package's, and a folder of its own for a catalogue deeper in it.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { catalogueCacheDir } from "../bin/forgebook/catalogueCache.ts";

const root = mkdtempSync(join(tmpdir(), "forgebook-cache-dir-"));
writeFileSync(join(root, "package.json"), "{}");
mkdirSync(join(root, "white-label", "dark"), { recursive: true });

describe("catalogueCacheDir", () => {
  afterAll(() => rmSync(root, { recursive: true }));

  it("is the package's own for a catalogue at its root", () => {
    expect(catalogueCacheDir(root)).toBe(join(root, "node_modules", ".vite"));
  });

  it("keeps two catalogues of one package apart", () => {
    expect(catalogueCacheDir(join(root, "white-label", "dark"))).toBe(
      join(root, "node_modules", ".vite", "catalogues", "white-label-dark")
    );
  });
});
