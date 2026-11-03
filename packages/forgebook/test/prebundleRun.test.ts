/**
 * Tests for a first start's pre-bundling: the imports Vite names as unresolved, which a second try leaves out, and
 * which later servers leave out until the installed packages change; the dev server built while it runs.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { unresolvedOf } from "../bin/forgebook/prebundleRun.ts";
import { serverAfterPrebundling } from "../bin/forgebook/prebundleStart.ts";
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

describe("serverAfterPrebundling", () => {
  /**
   * Builds the server as the dev command does, recording each build, with the imports it leaves out, and each
   * close.
   *
   * @param root - the catalogue's folder.
   * @param prebundling - what the child does, after the server started building: its result.
   * @param isForced - whether `--force` was given.
   */
  const run = async (
    root: string,
    prebundling: () => Promise<boolean>,
    isForced: boolean
  ): Promise<readonly string[]> => {
    const events: string[] = [];
    const create = async (
      isForcedHere: boolean,
      excluded: readonly string[]
    ): Promise<{ close: () => Promise<void> }> => {
      events.push(`create${isForcedHere ? " forced" : ""} [${excluded.join(",")}]`);
      return {
        close: async (): Promise<void> => {
          events.push("close");
        }
      };
    };
    // the child works while the server is built
    const later = async (): Promise<boolean> => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return prebundling();
    };
    await serverAfterPrebundling(root, later(), isForced, create);
    return events;
  };

  /** A catalogue's folder of its own. */
  const folder = (name: string): string => {
    const root = join(ROOT, name);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    return root;
  };

  it("keeps the server built while the child worked, when nothing it did changes its configuration", async () => {
    const root = folder("kept");
    expect(await run(root, async () => true, false)).toEqual(["create []"]);
    expect(await run(root, async () => false, false)).toEqual(["create []"]);
    expect(await run(root, async () => true, true)).toEqual(["create []"]);
  });

  it("builds it again when the child could not carry out --force", async () => {
    expect(await run(folder("forced"), async () => false, true)).toEqual([
      "create []",
      "close",
      "create forced []"
    ]);
  });

  it("builds it again with the imports the child found unresolved, as they are once it ended", async () => {
    const root = folder("found");
    const finding = async (): Promise<boolean> => {
      keepUnresolved(root, ["missing/a"]);
      return true;
    };
    expect(await run(root, finding, false)).toEqual(["create []", "close", "create [missing/a]"]);
    // a forced child removes the list and finds the same again: the server was built with it, and is kept
    const again = async (): Promise<boolean> => {
      rmSync(unresolvedFile(root));
      keepUnresolved(root, ["missing/a"]);
      return true;
    };
    expect(await run(root, again, true)).toEqual(["create [missing/a]"]);
  });
});
