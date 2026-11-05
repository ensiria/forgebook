/**
 * The fixture's server tests run twice as a project runs them: Vitest keeps each module's transform on disk between
 * runs, and a module read from there resolves no import.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** Vitest's command, found from its own package. */
const VITEST = join(dirname(fileURLToPath(import.meta.resolve("vitest/package.json"))), "vitest.mjs");

/** The fixture's folder. */
const FIXTURE = join(import.meta.dirname, "..");

/**
 * Runs the fixture's stories' tests in a process of its own.
 *
 * @param cache - the folder Vitest keeps its transforms in.
 */
const runStories = (cache: string): { readonly status: number | null; readonly output: string } => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [VITEST, "run", "src/stories.test.ts", "--fsModuleCache", "--fsModuleCachePath", cache],
    { cwd: FIXTURE, encoding: "utf8", timeout: 60_000 }
  );
  return { status, output: `${stdout}${stderr}` };
};

describe("Vitest's module cache", () => {
  it("passes the second run as it passes the first", { timeout: 120_000 }, () => {
    const cache = mkdtempSync(join(tmpdir(), "forgebook-vitest-cache-"));
    try {
      for (const run of [1, 2, 3]) {
        const { status, output } = runStories(cache);
        expect(status, `run ${run}: ${output}`).toBe(0);
      }
    } finally {
      rmSync(cache, { recursive: true, force: true });
    }
  });
});
