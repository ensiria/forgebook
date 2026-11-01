/**
 * What a metric's samples come to, and when two runs disagree.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { comparedMedians, summary } from "./benchStats.ts";

describe("summary", () => {
  it("gives the middle value of an odd count, and the range", () => {
    expect(summary([30, 10, 20])).toEqual({ median: 20, min: 10, max: 30, samples: 3 });
  });

  it("averages the two middle values of an even count", () => {
    expect(summary([10, 20, 30, 40]).median).toBe(25);
  });

  it("adds a p95 only with enough samples to mean something", () => {
    const edits = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(summary(edits).p95).toBe(29);
    expect(summary([1, 2, 3, 4, 5]).p95).toBeUndefined();
  });

  it("refuses no samples, which has no median", () => {
    expect(() => summary([])).toThrow("no samples");
  });
});

describe("comparedMedians", () => {
  it("lists a metric that moved more than the tolerance, and only that one", () => {
    const first = { coldStart: 1000, build: 2000 };
    const second = { coldStart: 1050, build: 2400 };
    expect(comparedMedians(first, second, 0.1)).toEqual([
      { metric: "build", first: 2000, second: 2400, change: 0.2 }
    ]);
  });

  it("lists a metric the second run lost, which is no agreement", () => {
    expect(comparedMedians({ build: 100 }, {}, 0.1)).toEqual([
      { metric: "build", first: 100, second: 0, change: 1 }
    ]);
  });

  it("ignores a metric only the second run has", () => {
    expect(comparedMedians({}, { coldStart: 2 }, 0.1)).toEqual([]);
  });
});
