/**
 * Tests for what a run leaves running: `ps`'s elapsed times, and the processes from the work folder found in its table.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { elapsedSeconds, leftoversIn, NO_DAEMONS } from "./leftovers.ts";

/** A `ps` table: the run (40), the shell that started it (30), Nx's daemon, an older server, an unrelated process. */
const TABLE = [
  "    1     0 12-03:00:00 /sbin/launchd",
  "   30     1    05:00 zsh -c node tools/bench/bench.mts --work /work",
  "   40    30    04:59 node tools/bench/bench.mts --work /work",
  "   50     1    02:10 node /work/corpus/fluentui/node_modules/nx/dist/src/daemon/server/start.js",
  "   60     1 01:00:00 node /work/corpus/old/server.js",
  "   70     1    01:00 node /elsewhere/server.js"
].join("\n");

describe("leftovers", () => {
  it("reads ps's elapsed times, with hours and days", () => {
    expect(elapsedSeconds("04:59")).toBe(299);
    expect(elapsedSeconds("01:00:00")).toBe(3600);
    expect(elapsedSeconds("12-03:00:00")).toBe(12 * 86_400 + 3 * 3600);
  });

  it("finds what runs from the work folder and started during the run, apart from the run and what started it", () => {
    expect(leftoversIn(TABLE, "/work", 300, 40)).toEqual([
      { pid: 50, command: "node /work/corpus/fluentui/node_modules/nx/dist/src/daemon/server/start.js" }
    ]);
  });

  it("turns Nx's daemon off in the commands", () => {
    expect(NO_DAEMONS["NX_DAEMON"]).toBe("false");
  });
});
