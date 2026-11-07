/**
 * Tests that a folder is written as Vite writes its root: through a link, and for one not made yet, from its nearest
 * folder that is.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { realFolder } from "../src/vite/realFolder.ts";

describe("realFolder", () => {
  const root = mkdtempSync(join(tmpdir(), "forgebook-real-folder-"));
  const real = realpathSync.native(root);
  mkdirSync(join(root, "app"));
  symlinkSync(join(root, "app"), join(root, "linked"), "junction");

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("follows a link to the folder", () => {
    expect(realFolder(join(root, "linked"))).toBe(join(real, "app"));
  });

  it("keeps the part of a path not made yet after its nearest real folder", () => {
    expect(realFolder(join(root, "linked", "site", "assets"))).toBe(join(real, "app", "site", "assets"));
  });
});
