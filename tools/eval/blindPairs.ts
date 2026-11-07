/**
 * The judges' pairs: each task's two arms of one repeat side by side, sides drawn at random and named by codes, and the
 * key that says which is which, kept apart from the judges' kit.
 *
 * @remarks
 * Pure: the measured runs and a seed in, the pairs, the key and each judge's sheet out. Each judge gets every pair in
 * an order of their own, so fatigue does not land on the same pairs, and a few pairs twice with their sides swapped
 * under another code, which measures how consistent each judge is. The key is fingerprinted (SHA-256) in the kit
 * before any score comes back, so anyone can check afterwards that it was not changed to fit the scores.
 *
 * @module
 */
import { createHash } from "node:crypto";

import type { Arm, RunMeasures } from "./eval.types.ts";
import { code, type Random, shuffled } from "./random.ts";

/** One side of a pair. */
export type PairSide = {
  /** The run's id, never shown to a judge. */
  readonly run: string;
  /** The run's arm, never shown to a judge. */
  readonly arm: Arm;
  /** The run's code, the name of its folder in the blinded outputs. */
  readonly code: string;
};

/** A pair the judges score. */
export type BlindPair = {
  /** Its code, the name of its folder in the kit. */
  readonly code: string;
  /** The task. */
  readonly task: string;
  /** The repeat. */
  readonly repeat: number;
  /** Side A. */
  readonly a: PairSide;
  /** Side B. */
  readonly b: PairSide;
  /** For a repeated pair, the code of the pair it repeats with its sides swapped. */
  readonly repeats?: string;
};

/** The key: everything needed to read the judges' sheets, kept away from them until they are in. */
export type BlindKey = {
  /** Every pair, the repeated ones included. */
  readonly pairs: readonly BlindPair[];
  /** The runs left out, each with why: a pair needs both arms measured. */
  readonly excluded: readonly { readonly task: string; readonly repeat: number; readonly reason: string }[];
};

/** The criteria the judges score, in the sheet's order, each from -2 (A much better) to 2 (B much better). */
export const CRITERIA = ["asked", "design", "states", "accessible", "code", "overall"] as const;

/** A criterion. */
export type Criterion = (typeof CRITERIA)[number];

/** The sheet's columns. */
export const SHEET_COLUMNS = [
  "judge",
  "pair",
  ...CRITERIA,
  "merge_a",
  "merge_b",
  "guess_tool",
  "minutes",
  "notes"
] as const;

/**
 * The pairs of the measured runs, and the key.
 *
 * @param runs - every run's measures.
 * @param tasks - every task's id, so a task with no run at all is listed too.
 * @param repeats - how many repeats the evaluation ran.
 * @param duplicates - how many pairs are shown twice, sides swapped.
 * @param random - the generator: in an evaluation, one no seed predicts, or a judge could search for the seed.
 */
export const blindPairs = (
  runs: readonly RunMeasures[],
  tasks: readonly string[],
  repeats: number,
  duplicates: number,
  random: Random
): BlindKey => {
  const used = new Set<string>();
  const fresh = (length: number): string => {
    let value = code(random, length);
    while (used.has(value)) value = code(random, length);
    used.add(value);
    return value;
  };
  const pairs: BlindPair[] = [];
  const excluded: BlindKey["excluded"][number][] = [];
  const slots = tasks.flatMap((task) =>
    Array.from({ length: repeats }, (_, index) => ({ task, repeat: index + 1 }))
  );
  for (const { task, repeat } of slots) {
    const of = (arm: Arm): RunMeasures | undefined =>
      runs.find((run) => run.task === task && run.repeat === repeat && run.arm === arm);
    const withRun = of("with");
    const withoutRun = of("without");
    if (withRun === undefined || withoutRun === undefined) {
      const missing = (["with", "without"] as const).filter((arm) => of(arm) === undefined);
      excluded.push({ task, repeat, reason: `no measures for ${missing.join(" and ")}` });
      continue;
    }
    const sides: [PairSide, PairSide] = [
      { run: withRun.id, arm: "with", code: fresh(6) },
      { run: withoutRun.id, arm: "without", code: fresh(6) }
    ];
    const [a, b] = random() < 0.5 ? sides : [sides[1], sides[0]];
    pairs.push({ code: fresh(4), task, repeat, a, b });
  }
  const repeated = shuffled(pairs, random)
    .slice(0, Math.min(duplicates, pairs.length))
    .map((pair): BlindPair => ({ ...pair, code: fresh(4), a: pair.b, b: pair.a, repeats: pair.code }));
  return { pairs: [...pairs, ...repeated], excluded };
};

/**
 * The key's fingerprint, published in the kit before any score comes back.
 *
 * @param keyText - the key file's text.
 */
export const keyFingerprint = (keyText: string): string => createHash("sha256").update(keyText).digest("hex");

/** A value written into a CSV cell, quoted when it must be. */
const cell = (value: string): string => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/**
 * A judge's sheet: a header, then one empty row per pair, in an order of the judge's own.
 *
 * @param judge - the judge's number, from 1.
 * @param pairs - every pair.
 * @param random - the generator.
 */
export const judgeSheet = (judge: number, pairs: readonly BlindPair[], random: Random): string => {
  const rows = shuffled(pairs, random).map((pair) =>
    SHEET_COLUMNS.map((column) => {
      if (column === "judge") return String(judge);
      if (column === "pair") return pair.code;
      return "";
    })
      .map(cell)
      .join(",")
  );
  return `${[SHEET_COLUMNS.join(","), ...rows].join("\n")}\n`;
};
