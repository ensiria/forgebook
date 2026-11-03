/**
 * Tests for where the `forgebook` command keeps Node's compile cache.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { compileCacheFolder } from "../bin/forgebook/compileCache.ts";

describe("compileCacheFolder", () => {
  it("keeps it in the Vite cache of the project's node_modules, a nested store included", () => {
    const project = join("/", "work", "app");
    const flat = join(project, "node_modules", "forgebook", "dist", "bin", "forgebook");
    const nested = join(
      project,
      "node_modules",
      ".pnpm",
      "forgebook@1.0.0",
      "node_modules",
      "forgebook",
      "dist",
      "bin"
    );
    const expected = join(project, "node_modules", ".vite", "forgebook", "compile");
    expect(compileCacheFolder(flat)).toBe(expected);
    expect(compileCacheFolder(nested)).toBe(expected);
  });

  it("keeps none for Forgebook run from its sources", () => {
    expect(
      compileCacheFolder(join("/", "src", "forgebook", "packages", "forgebook", "bin", "forgebook"))
    ).toBeUndefined();
  });
});
