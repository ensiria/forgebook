/**
 * Tests for a first start's pre-bundling: the imports Vite names as unresolved, which a second try leaves out, and
 * which later servers leave out until the installed packages change.
 *
 * @module
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { unresolvedOf } from "../bin/forgebook/prebundleRun.ts";
import { keepUnresolved, unresolvedFile, unresolvedImports } from "../bin/forgebook/viteCache.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-prebundle-"));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("unresolvedOf", () => {
  it("reads the names Vite's error lists, and nothing from another error", () => {
    const error = new Error(
      "The following dependencies are imported but could not be resolved:\n\n" +
        "  vanilla-starter/Popover (imported by /repo/stories/TokenField.stories.tsx)\n" +
        "  vanilla-starter/Button (imported by /repo/stories/PreviewTrigger.stories.tsx)\n\nAre they installed?"
    );
    expect(unresolvedOf(error)).toEqual(["vanilla-starter/Popover", "vanilla-starter/Button"]);
    const coloured = new Error(
      "could not be resolved:\n\n  \u001b[36mvanilla-starter/Popover\u001b[39m (imported by /repo/a.tsx)\n"
    );
    expect(unresolvedOf(coloured)).toEqual(["vanilla-starter/Popover"]);
    expect(unresolvedOf(new Error("something else"))).toEqual([]);
    expect(unresolvedOf("not an error")).toEqual([]);
  });
});

describe("unresolvedImports", () => {
  it("leaves out what the pre-bundling could not resolve, until the installed packages change", () => {
    writeFileSync(join(ROOT, "package.json"), "{}");
    writeFileSync(join(ROOT, "pnpm-lock.yaml"), "lockfileVersion: 9\n");
    expect(unresolvedImports(ROOT)).toEqual([]);
    keepUnresolved(ROOT, ["missing/a", "@acme/late/b"]);
    expect(unresolvedImports(ROOT)).toEqual(["missing/a", "@acme/late/b"]);
    // an install rewrites the lock file: Vite pre-bundles again, and so does what resolves now
    writeFileSync(join(ROOT, "pnpm-lock.yaml"), "lockfileVersion: 9\npackages: {}\n");
    expect(unresolvedImports(ROOT)).toEqual([]);
    writeFileSync(unresolvedFile(ROOT), "{ half");
    expect(unresolvedImports(ROOT)).toEqual([]);
  });
});
