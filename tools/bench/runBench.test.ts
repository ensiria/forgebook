/**
 * The order tools take their turns in, and what the report keeps of a metric's samples.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { measured, roundOrder } from "./runBench.ts";

const TOOLS = ["a", "b", "c"];
const ROUNDS = [1, 2, 3, 4, 5, 6].map((run) => roundOrder(TOOLS, run));

describe("roundOrder", () => {
  it("keeps every tool in every round", () => {
    for (const round of ROUNDS) expect(round.toSorted()).toEqual(TOOLS);
  });

  it("lets each tool lead", () => {
    expect(new Set(ROUNDS.map((round) => round[0])).size).toBe(3);
  });

  it("gives no tool a single predecessor", () => {
    const after = new Map<string, Set<string>>();
    for (const round of ROUNDS) {
      round.forEach((tool, index) => {
        const before = round[index - 1];
        if (before !== undefined) after.set(tool, (after.get(tool) ?? new Set()).add(before));
      });
    }
    for (const tool of TOOLS) expect(after.get(tool)?.size).toBe(2);
  });
});

describe("measured", () => {
  it("keeps every sample in the order taken beside the median, so a spread in two places shows", () => {
    const peaks = [630, 760, 640, 650, 770, 620, 645];
    expect(measured("bytes", peaks)).toEqual({
      kind: "measured",
      unit: "bytes",
      summary: expect.objectContaining({ median: 645, min: 620, max: 770, samples: 7 }),
      values: peaks
    });
  });
});
