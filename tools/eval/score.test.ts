/**
 * The judges' result: sheets read, scores turned toward the arm with Forgebook, repeats kept out of the estimate, and
 * the statistics behind it checked against values worked out by hand.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { blindPairs, SHEET_COLUMNS } from "./blindPairs.ts";
import { seeded } from "./random.ts";
import { checkedRatings, csvRecords, oriented, parseSheet, type Rating, scoreReport } from "./score.ts";
import { krippendorffAlpha, mean, plannedSample, quantile, signFlipP, wilson } from "./stats.ts";
import { measured } from "./testRuns.ts";

const TASKS = ["a", "b", "c", "d"];
const RUNS = TASKS.flatMap((task) => [measured(task, "with", 1), measured(task, "without", 1)]);

describe("a judge's sheet", () => {
  it("reads filled rows, and says what is wrong with the rest", () => {
    const text = [
      SHEET_COLUMNS.join(","),
      '1,ab12,1,0,-1,2,0,1,yes,no,B,4,"long, but fine"',
      "1,cd34,,,,,,,,,,,",
      "1,ef56,3,0,0,0,0,0,yes,yes,unsure,2,"
    ].join("\n");
    const { ratings, problems } = parseSheet(text, "judge-1.csv");
    expect(ratings).toHaveLength(2);
    expect(ratings[0]).toMatchObject({ pair: "ab12", mergeA: true, mergeB: false, guess: "B" });
    expect(ratings[0]?.scores).toMatchObject({ asked: 1, states: -1, overall: 1 });
    expect(problems.join("\n")).toMatch(/row 3: overall is empty/);
    expect(problems.join("\n")).toMatch(/row 4: asked must be a whole number/);
  });

  it("refuses a sheet whose columns were changed", () => {
    expect(parseSheet("judge,pair,score\n1,ab,1\n", "x.csv").problems[0]).toMatch(/header/);
  });
});

describe("the judges' result", () => {
  const key = blindPairs(RUNS, TASKS, 1, 1, seeded(5));
  const primary = key.pairs.filter((pair) => pair.repeats === undefined);
  /** Every judge prefers the arm with Forgebook by one point on every primary pair. */
  const favouring = (judges: readonly string[]): Rating[] =>
    judges.flatMap((judge) =>
      key.pairs.map((pair) => {
        const towardWith = pair.b.arm === "with" ? 1 : -1;
        return {
          judge,
          pair: pair.code,
          scores: { overall: towardWith, design: towardWith },
          mergeA: pair.a.arm === "with",
          mergeB: pair.b.arm === "with",
          guess: "unsure" as const
        };
      })
    );

  it("turns every score toward the arm with Forgebook", () => {
    for (const pair of primary) expect(oriented(pair.b.arm === "with" ? 2 : -2, pair)).toBe(2);
  });

  it("finds a clear preference when every judge agrees, and counts no repeat twice", () => {
    const report = scoreReport(key, favouring(["1", "2", "3"]), seeded(9));
    expect(report.counts).toEqual({ pairs: 4, tasks: 4, judges: 3, ratings: 12 });
    expect(report.overall.value).toBe(1);
    expect(report.overall.low).toBe(1);
    expect(report.winRate.value).toBe(1);
    expect(report.merge.with.value).toBe(1);
    expect(report.merge.without.value).toBe(0);
    expect(report.agreement).toBe(1);
    expect(report.consistency).toEqual({ repeats: 3, meanDifference: 0 });
    expect(Number.isNaN(report.blinding.value)).toBe(true);
    expect(report.blinding.unsure).toBe(1);
  });

  it("reads the guesses of the arm", () => {
    const guessing = favouring(["1"]).map((rating): Rating => {
      const pair = key.pairs.find((each) => each.code === rating.pair);
      return { ...rating, guess: pair?.a.arm === "with" ? "A" : "B" };
    });
    expect(scoreReport(key, guessing, seeded(1)).blinding.value).toBe(1);
  });
});

describe("the statistics", () => {
  it("take means and quantiles", () => {
    expect(mean([1, 2, 3, 6])).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });

  it("compute Krippendorff's alpha", () => {
    expect(
      krippendorffAlpha([
        [1, 1],
        [2, 2],
        [-1, -1]
      ])
    ).toBe(1);
    // values that disagree within units as much as across them: no agreement beyond chance
    expect(
      krippendorffAlpha([
        [1, -1],
        [1, -1],
        [1, -1]
      ])
    ).toBeLessThan(0);
    // worked by hand: units (1,2), (3,3); observed 2/4, expected 22/12 (ordered pairs of 1, 2, 3, 3)
    expect(
      krippendorffAlpha([
        [1, 2],
        [3, 3]
      ])
    ).toBeCloseTo(1 - 0.5 / (22 / 12), 10);
  });

  it("give Wilson's interval", () => {
    const { value, low, high } = wilson(8, 10);
    expect(value).toBe(0.8);
    expect(low).toBeCloseTo(0.4902, 3);
    expect(high).toBeCloseTo(0.9433, 3);
  });

  it("find no effect in balanced scores, and one in scores all of one sign", () => {
    expect(signFlipP([[1], [-1], [1], [-1]], seeded(1))).toBeGreaterThan(0.5);
    const allPositive = Array.from({ length: 12 }, () => [1, 1]);
    expect(signFlipP(allPositive, seeded(1))).toBeLessThan(0.01);
  });

  it("plan the pairs a win rate needs", () => {
    const plan = plannedSample({ winRate: 0.65, alpha: 0.05, power: 0.8, icc: 0.3, repeats: 3 });
    expect(plan.independentPairs).toBe(85);
    expect(plan.pairs).toBe(136);
    expect(plan.tasks).toBe(46);
    expect(
      plannedSample({ winRate: 0.7, alpha: 0.05, power: 0.8, icc: 0, repeats: 1 }).independentPairs
    ).toBe(47);
  });
});

describe("a sheet saved by a spreadsheet", () => {
  it("reads quotes across lines, a byte-order mark and semicolons", () => {
    expect(csvRecords('﻿a,b\r\n1,"x, ""y""\nz"\r\n')).toEqual([
      ["a", "b"],
      ["1", 'x, "y"\nz']
    ]);
    expect(csvRecords("a;b\n1;2\n")).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
    expect(csvRecords("a,b\n1,\n")).toEqual([
      ["a", "b"],
      ["1", ""]
    ]);
  });

  it("leaves out pairs the key does not hold, and counts a judge's pair once", () => {
    const key = blindPairs(RUNS, TASKS, 1, 0, seeded(5));
    const first = key.pairs[0]?.code ?? "";
    const rating = (pair: string, overall: number): Rating => ({
      judge: "1",
      pair,
      scores: { overall },
      guess: "unsure"
    });
    const { ratings, problems } = checkedRatings(key, [
      rating(first, 1),
      rating(first, 2),
      rating("zzzz", 1)
    ]);
    expect(ratings).toEqual([rating(first, 2)]);
    expect(problems).toHaveLength(2);
  });
});
