/**
 * Tests for what a run leaves running: `ps`'s elapsed times, and the processes from the work folder found in its table.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { elapsedSeconds, LISTING_COMMAND, leftoversIn } from "./leftovers.ts";

/**
 * A `ps` table: the run (40) and the shell that started it (30); Nx's daemon, detached; an older server; an unrelated
 * process; a server the run started and did not stop (80, with a child 81); another run on a folder sharing the
 * prefix, with its daemon (90, 91); a person's `tail` on the run's report (95); the listing itself (99).
 */
const TABLE = [
  "    1     0 12-03:00:00 /sbin/launchd",
  "   30     1    05:00 zsh -c node tools/bench/bench.mts --work /work",
  "   40    30    04:59 node tools/bench/bench.mts --work /work",
  "   50     1    02:10 node /work/corpus/fluentui/node_modules/nx/dist/src/daemon/server/start.js",
  "   60     1 01:00:00 node /work/corpus/old/server.js",
  "   70     1    01:00 node /elsewhere/server.js",
  "   80    40    01:00 node /work/forgebook/node_modules/.bin/forgebook dev",
  "   81    80    00:59 node /somewhere/esbuild --service",
  "   90    31    03:00 node tools/bench/bench.mts --work /work-2",
  "   91     1    02:00 node /work-2/corpus/fluentui/node_modules/nx/daemon.js",
  "   95    32    01:00 tail -F /work/status.jsonl",
  `   99    40    00:00 ${LISTING_COMMAND}`
].join("\n");

describe("leftovers", () => {
  it("reads ps's elapsed times, with hours and days", () => {
    expect(elapsedSeconds("04:59")).toBe(299);
    expect(elapsedSeconds("01:00:00")).toBe(3600);
    expect(elapsedSeconds("12-03:00:00")).toBe(12 * 86_400 + 3 * 3600);
  });

  it("finds what the run started and what detached from it, never the run, another run or a person's process", () => {
    expect(leftoversIn(TABLE, "/work", 300, 40).map(({ pid }) => pid)).toEqual([50, 80, 81]);
  });

  it("reads a folder given with its final separator alike", () => {
    expect(leftoversIn(TABLE, "/work/", 300, 40).map(({ pid }) => pid)).toEqual([50, 80, 81]);
  });
});
