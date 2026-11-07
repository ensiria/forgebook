/**
 * The judges' pairs: one per task and repeat with both arms measured, sides drawn at random, repeats swapped, and the
 * same seed giving the same pairs.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { blindPairs, judgeSheet, keyFingerprint, SHEET_COLUMNS } from "./blindPairs.ts";
import { seeded } from "./random.ts";
import { runId } from "./runPlan.ts";
import { measured } from "./testRuns.ts";

const RUNS = ["a", "b", "c"].flatMap((task) =>
  [1, 2].flatMap((repeat) => [measured(task, "with", repeat), measured(task, "without", repeat)])
);

describe("the pairs", () => {
  it("pair every task and repeat measured in both arms, and list what is left out", () => {
    const runs = RUNS.filter((run) => run.id !== runId("c", "without", 2));
    const key = blindPairs(runs, ["a", "b", "c"], 2, 0, seeded(1));
    expect(key.pairs).toHaveLength(5);
    expect(key.excluded).toEqual([{ task: "c", repeat: 2, reason: "no measures for without" }]);
    for (const pair of key.pairs)
      expect(new Set([pair.a.arm, pair.b.arm])).toEqual(new Set(["with", "without"]));
  });

  it("draw both sides for the arm with Forgebook, over enough pairs", () => {
    const many = Array.from({ length: 40 }, (_, index) => `t${index}`);
    const runs = many.flatMap((task) => [measured(task, "with", 1), measured(task, "without", 1)]);
    const key = blindPairs(runs, many, 1, 0, seeded(7));
    const onB = key.pairs.filter((pair) => pair.b.arm === "with").length;
    expect(onB).toBeGreaterThan(10);
    expect(onB).toBeLessThan(30);
  });

  it("repeat a few pairs with their sides swapped, under a new code", () => {
    const key = blindPairs(RUNS, ["a", "b", "c"], 2, 2, seeded(1));
    const repeated = key.pairs.filter((pair) => pair.repeats !== undefined);
    expect(repeated).toHaveLength(2);
    for (const pair of repeated) {
      const original = key.pairs.find((each) => each.code === pair.repeats);
      expect(original?.a.run).toBe(pair.b.run);
      expect(pair.code).not.toBe(original?.code);
    }
    expect(new Set(key.pairs.map((pair) => pair.code)).size).toBe(key.pairs.length);
  });

  it("are the same for the same seed", () => {
    expect(blindPairs(RUNS, ["a", "b", "c"], 2, 2, seeded(3))).toEqual(
      blindPairs(RUNS, ["a", "b", "c"], 2, 2, seeded(3))
    );
  });
});

describe("a judge's sheet", () => {
  it("has the kit's header and one empty row per pair", () => {
    const key = blindPairs(RUNS, ["a", "b", "c"], 2, 0, seeded(1));
    const lines = judgeSheet(2, key.pairs, seeded(2)).trim().split("\n");
    expect(lines[0]).toBe(SHEET_COLUMNS.join(","));
    expect(lines).toHaveLength(key.pairs.length + 1);
    expect(lines[1]).toMatch(/^2,[a-z0-9]{4},/);
  });

  it("fingerprints the key", () => {
    expect(keyFingerprint("x")).toHaveLength(64);
  });
});
