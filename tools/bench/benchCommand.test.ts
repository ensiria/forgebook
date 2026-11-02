/**
 * The command run as a process: only what needs no install or browser.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ENTRY = join(import.meta.dirname, "bench.mts");

const run = (...args: readonly string[]): ReturnType<typeof spawnSync> =>
  spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

describe("bench", () => {
  it("documents --json and its options", () => {
    const { status, stdout } = run("--help");
    expect(status).toBe(0);
    expect(String(stdout)).toContain("--json");
    expect(String(stdout)).toContain("--status");
  });

  it("refuses a group of metrics it does not know, before doing any work", () => {
    const { status, stderr } = run("--metric", "nonsense");
    expect(status).not.toBe(0);
    expect(String(stderr)).toContain("unknown --metric: nonsense");
  });

  it("refuses an --against file that is not a report", () => {
    const { status } = run("--against", ENTRY);
    expect(status).not.toBe(0);
  });
});
