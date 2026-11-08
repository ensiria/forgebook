/**
 * The judges' result: their sheets read, each score turned so a positive one favours the arm with Forgebook, and the
 * estimates with their intervals, the agreement between judges, their consistency and whether the blinding held.
 *
 * @remarks
 * The primary outcome, fixed before any score: the mean `overall` score over the pairs, on -2 to 2, with a 95 %
 * interval from a bootstrap over tasks and judges, and a sign-flip test over tasks. The win rate (ties counted half),
 * each criterion and the merge decisions are secondary. Repeated pairs measure consistency only and never count twice.
 *
 * @module
 */
import { type BlindKey, type BlindPair, CRITERIA, type Criterion, SHEET_COLUMNS } from "./blindPairs.ts";
import type { Random } from "./random.ts";
import { crossedBootstrap, type Estimate, krippendorffAlpha, mean, signFlipP, wilson } from "./stats.ts";

/** One judge's row for one pair. */
export type Rating = {
  /** The judge. */
  readonly judge: string;
  /** The pair's code. */
  readonly pair: string;
  /** Each criterion, from -2 (A much better) to 2 (B much better); absent when left empty. */
  readonly scores: Readonly<Partial<Record<Criterion, number>>>;
  /** Whether the judge would merge side A as it is. */
  readonly mergeA?: boolean;
  /** Whether the judge would merge side B as it is. */
  readonly mergeB?: boolean;
  /** Which side the judge thinks had the tool. */
  readonly guess: "A" | "B" | "unsure";
};

/**
 * A CSV document's records, quotes understood across lines, a byte-order mark dropped, and the separator a
 * spreadsheet chose: a comma, or a semicolon where the decimal mark is a comma.
 *
 * @param text - the document.
 */
export const csvRecords = (text: string): string[][] => {
  const body = text
    .replace(/^\uFEFF/, "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
  const firstLine = body.split("\n", 1)[0] ?? "";
  const separator = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  // a cell: quoted (quotes doubled inside, line breaks allowed) or plain, then what ends it
  const cell = new RegExp(`("(?:[^"]|"")*"|[^${separator}\\n"]*)(${separator}|\\n|$)`, "g");
  const records: string[][] = [];
  let record: string[] = [];
  for (const [whole, value = "", end] of body.matchAll(cell)) {
    if (whole === "") break;
    record.push(value.startsWith('"') ? value.slice(1, -1).replaceAll('""', '"') : value);
    if (end !== separator) {
      records.push(record);
      record = [];
    }
  }
  if (record.length > 0) records.push(record);
  return records.filter((each) => each.some((value) => value.trim() !== ""));
};

/** A yes or a no, or nothing when the cell holds neither. */
const yesOrNo = (value: string | undefined): boolean | undefined => {
  if (value === "yes") return true;
  return value === "no" ? false : undefined;
};

/** A row's scores, with a problem for each that is not a whole number from -2 to 2. */
const scoresOf = (
  row: Readonly<Record<string, string>>,
  where: string,
  problems: string[]
): Partial<Record<Criterion, number>> => {
  const scores: Partial<Record<Criterion, number>> = {};
  for (const criterion of CRITERIA) {
    const value = row[criterion] ?? "";
    const number = Number(value);
    if (value === "") continue;
    if (Number.isInteger(number) && number >= -2 && number <= 2) scores[criterion] = number;
    else problems.push(`${where}: ${criterion} must be a whole number from -2 to 2, not "${value}"`);
  }
  return scores;
};

/** One row of a sheet, or nothing when its `overall` is empty. */
const ratingOf = (
  row: Readonly<Record<string, string>>,
  where: string,
  problems: string[]
): Rating | undefined => {
  const scores = scoresOf(row, where, problems);
  if ((row["judge"] ?? "") === "" || (row["pair"] ?? "") === "") {
    problems.push(`${where}: judge or pair is empty, the row is left out`);
    return undefined;
  }
  if (scores.overall === undefined) {
    problems.push(`${where}: overall is empty, the row is left out`);
    return undefined;
  }
  const guess = row["guess_tool"] === "A" || row["guess_tool"] === "B" ? row["guess_tool"] : "unsure";
  const mergeA = yesOrNo(row["merge_a"]);
  const mergeB = yesOrNo(row["merge_b"]);
  return {
    judge: row["judge"] ?? "",
    pair: row["pair"] ?? "",
    scores,
    guess,
    ...(mergeA === undefined ? {} : { mergeA }),
    ...(mergeB === undefined ? {} : { mergeB })
  };
};

/**
 * Reads a judge's sheet.
 *
 * @param text - the CSV.
 * @param file - its name, for the problems.
 * @returns the ratings filled in, and what is wrong with the rest.
 */
export const parseSheet = (
  text: string,
  file: string
): { readonly ratings: Rating[]; readonly problems: string[] } => {
  const [header = [], ...rows] = csvRecords(text);
  const problems: string[] = [];
  if (header.map((cell) => cell.trim()).join(",") !== SHEET_COLUMNS.join(","))
    return { ratings: [], problems: [`${file}: the header is not the kit's: ${SHEET_COLUMNS.join(",")}`] };
  const ratings = rows.flatMap((cells, index): Rating[] => {
    const row = Object.fromEntries(header.map((column, at) => [column.trim(), (cells[at] ?? "").trim()]));
    const rating = ratingOf(row, `${file} row ${index + 2}`, problems);
    return rating === undefined ? [] : [rating];
  });
  return { ratings, problems };
};

/**
 * The ratings the key can read, once each: a pair code the key does not hold is left out, and a judge's second row for
 * one pair replaces the first (a sheet sent again), each with a problem saying so.
 *
 * @param key - the key.
 * @param ratings - every sheet's ratings, in the order read.
 */
export const checkedRatings = (
  key: BlindKey,
  ratings: readonly Rating[]
): { readonly ratings: Rating[]; readonly problems: string[] } => {
  const codes = new Set(key.pairs.map((pair) => pair.code));
  const problems: string[] = [];
  const kept = new Map<string, Rating>();
  for (const rating of ratings) {
    if (!codes.has(rating.pair)) {
      problems.push(`judge ${rating.judge}: pair ${rating.pair} is not in the key, the row is left out`);
      continue;
    }
    const slot = `${rating.judge}\u0000${rating.pair}`;
    if (kept.has(slot))
      problems.push(`judge ${rating.judge} scored pair ${rating.pair} twice: the last row counts`);
    kept.set(slot, rating);
  }
  return { ratings: [...kept.values()], problems };
};

/**
 * A score turned so a positive one favours the arm with Forgebook.
 *
 * @param score - the judge's score, positive when B is better.
 * @param pair - the pair.
 */
export const oriented = (score: number, pair: BlindPair): number => (pair.b.arm === "with" ? score : -score);

/** The judges' result. */
export type ScoreReport = {
  /** Pairs scored, judges, ratings. */
  readonly counts: {
    readonly pairs: number;
    readonly tasks: number;
    readonly judges: number;
    readonly ratings: number;
  };
  /** The primary outcome: the mean oriented `overall`, -2 to 2. */
  readonly overall: Estimate & { readonly p: number };
  /** The share of judgements favouring the arm with Forgebook, ties counted half. */
  readonly winRate: Estimate;
  /** Each criterion's mean oriented score. */
  readonly criteria: Readonly<Record<Criterion, Estimate>>;
  /** The share of sides the judges would merge as they are, by arm. */
  readonly merge: { readonly with: Estimate; readonly without: Estimate };
  /** Krippendorff's alpha on `overall` between judges. */
  readonly agreement: number;
  /** On repeated pairs: the mean absolute difference between a judge's two oriented `overall` scores. */
  readonly consistency: { readonly repeats: number; readonly meanDifference: number };
  /** Correct guesses of the arm, among the judgements that guessed, and the share left unsure. */
  readonly blinding: Estimate & { readonly unsure: number };
};

/**
 * Computes the judges' result.
 *
 * @param key - the key.
 * @param ratings - every sheet's ratings.
 * @param random - the generator for the bootstrap and the test.
 */
export const scoreReport = (key: BlindKey, ratings: readonly Rating[], random: Random): ScoreReport => {
  const pairs = new Map(key.pairs.map((pair) => [pair.code, pair]));
  const primary = ratings.filter((rating) => {
    const pair = pairs.get(rating.pair);
    return pair !== undefined && pair.repeats === undefined;
  });
  const pairOf = (rating: Rating): BlindPair | undefined => pairs.get(rating.pair);
  const tasks = [...new Set(primary.map((rating) => pairOf(rating)?.task ?? ""))];
  const judges = [...new Set(primary.map((rating) => rating.judge))];
  // each (task, judge) cell's ratings found once, not on every one of the bootstrap's draws
  const cells = new Map<string, Rating[]>();
  for (const rating of primary) {
    const cell = `${pairOf(rating)?.task ?? ""}\u0000${rating.judge}`;
    cells.set(cell, [...(cells.get(cell) ?? []), rating]);
  }
  const scored = (
    criterion: Criterion,
    chosenTasks: readonly string[],
    chosenJudges: readonly string[]
  ): number[] =>
    chosenTasks.flatMap((task) =>
      chosenJudges.flatMap((judge) =>
        (cells.get(`${task}\u0000${judge}`) ?? []).flatMap((rating) => {
          const pair = pairOf(rating);
          const score = rating.scores[criterion];
          return pair !== undefined && score !== undefined ? [oriented(score, pair)] : [];
        })
      )
    );
  const estimate = (criterion: Criterion): Estimate =>
    crossedBootstrap(
      tasks,
      judges,
      (chosenTasks, chosenJudges) => mean(scored(criterion, chosenTasks, chosenJudges)),
      random
    );
  const win = (score: number): number => {
    if (score === 0) return 0.5;
    return score > 0 ? 1 : 0;
  };
  const winRate = crossedBootstrap(
    tasks,
    judges,
    (chosenTasks, chosenJudges) => mean(scored("overall", chosenTasks, chosenJudges).map(win)),
    random
  );
  const byTask = tasks.map((task) => scored("overall", [task], judges));
  const criteria: Record<Criterion, Estimate> = {
    asked: estimate("asked"),
    design: estimate("design"),
    states: estimate("states"),
    accessible: estimate("accessible"),
    code: estimate("code"),
    overall: estimate("overall")
  };
  const mergeOf = (arm: "with" | "without"): Estimate => {
    const decisions = primary.flatMap((rating) => {
      const pair = pairOf(rating);
      if (pair === undefined) return [];
      const decision = pair.a.arm === arm ? rating.mergeA : rating.mergeB;
      return decision === undefined ? [] : [decision];
    });
    return wilson(decisions.filter(Boolean).length, decisions.length);
  };
  const units = [...pairs.values()]
    .filter((pair) => pair.repeats === undefined)
    .map((pair) =>
      primary.flatMap((rating) =>
        rating.pair === pair.code && rating.scores.overall !== undefined
          ? [oriented(rating.scores.overall, pair)]
          : []
      )
    );
  const differences = ratings.flatMap((rating) => {
    const pair = pairOf(rating);
    if (pair?.repeats === undefined || rating.scores.overall === undefined) return [];
    const first = ratings.find((each) => each.judge === rating.judge && each.pair === pair.repeats);
    const original = first === undefined ? undefined : pairs.get(first.pair);
    if (first?.scores.overall === undefined || original === undefined) return [];
    return [Math.abs(oriented(rating.scores.overall, pair) - oriented(first.scores.overall, original))];
  });
  const guesses = primary.filter((rating) => rating.guess !== "unsure");
  const correct = guesses.filter((rating) => {
    const pair = pairOf(rating);
    return pair !== undefined && (rating.guess === "A" ? pair.a.arm : pair.b.arm) === "with";
  });
  return {
    counts: {
      pairs: units.filter((unit) => unit.length > 0).length,
      tasks: tasks.length,
      judges: judges.length,
      ratings: primary.length
    },
    overall: { ...criteria.overall, p: signFlipP(byTask, random) },
    winRate,
    criteria,
    merge: { with: mergeOf("with"), without: mergeOf("without") },
    agreement: krippendorffAlpha(units),
    consistency: { repeats: differences.length, meanDifference: mean(differences) },
    blinding: {
      ...wilson(correct.length, guesses.length),
      unsure: primary.length === 0 ? Number.NaN : 1 - guesses.length / primary.length
    }
  };
};
