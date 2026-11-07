/**
 * Writes what the judges and the analysis get from the measured runs: the judges' kit, the blinded runs and the key.
 *
 * @remarks
 * Three places, so the key never travels with the kit: `kit/` goes to the judges (the instructions, a page per pair
 * with both sides' pictures and diffs, a sheet per judge); `blind/runs/<code>/` holds each run's pictures, diff and
 * measures with everything that names its arm taken out, for whoever prepares the analysis without being unblinded;
 * the key file, outside both, holds the key, which stays with the person running the evaluation until every sheet is in. A pair's page is
 * plain HTML with no script and nothing fetched, so it opens from a folder or a shared drive.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { BlindKey, BlindPair, PairSide } from "./blindPairs.ts";
import { judgeSheet, keyFingerprint } from "./blindPairs.ts";
import type { EvalTask, RunMeasures } from "./eval.types.ts";
import type { Random } from "./random.ts";

/** Text made safe inside HTML. */
const escaped = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * A run's measures with what names its arm taken out: its id, arm, repeat and agent, and the story and set-up files,
 * which only the arm with Forgebook tends to write.
 *
 * @param measures - the run's measures.
 * @param runCode - its code.
 */
export const blindMeasures = (measures: RunMeasures, runCode: string): Readonly<Record<string, unknown>> => {
  const {
    id: _id,
    arm: _arm,
    repeat: _repeat,
    agent: _agent,
    forgebook: _forgebook,
    definition: _definition,
    files,
    ...rest
  } = measures;
  const { stories: _stories, tooling: _tooling, ...productFiles } = files;
  return { code: runCode, ...rest, files: productFiles };
};

/** One side's column of a pair's page: the state's picture, or why there is none. */
const sidePicture = (side: "A" | "B", measures: RunMeasures, state: string): string => {
  const found = measures.states.find((each) => each.name === state);
  if (found?.picture === undefined)
    return `<td><p class="missing">Side ${side}: this state could not be reached (${escaped(found?.error ?? "not run")}).</p></td>`;
  return `<td><a href="${side}/${escaped(found.picture)}"><img src="${side}/${escaped(found.picture)}" alt="Side ${side}, ${escaped(state)}"></a></td>`;
};

/**
 * A pair's page: the task, then each state's two pictures side by side, then both diffs.
 *
 * @param pair - the pair.
 * @param task - its task.
 * @param a - side A's measures.
 * @param b - side B's measures.
 * @param diffs - each side's diff.
 */
export const pairPage = (
  pair: BlindPair,
  task: EvalTask,
  a: RunMeasures,
  b: RunMeasures,
  diffs: { readonly a: string; readonly b: string }
): string => {
  const constraints = task.constraints
    .map((each) => `<li><b>${each.id}</b>: ${escaped(each.text)}</li>`)
    .join("");
  const states = task.states
    .map(
      (state) =>
        `<h3>${escaped(state.name)}</h3><p>${escaped(state.description)} (${state.viewport}, ${state.scheme})</p>` +
        `<table><tr><th>A</th><th>B</th></tr><tr>${sidePicture("A", a, state.name)}${sidePicture("B", b, state.name)}</tr></table>`
    )
    .join("\n");
  const diff = (side: string, text: string): string =>
    `<details open><summary>Side ${side}: the change</summary><pre>${escaped(text === "" ? "(no change to the product)" : text)}</pre></details>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Pair ${pair.code}</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1500px}
table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{vertical-align:top;padding:6px;border:1px solid #bbb}
img{max-width:100%;height:auto;display:block}pre{white-space:pre-wrap;font-size:12px;background:#f4f4f4;padding:8px}
.missing{color:#a00}
</style></head><body>
<h1>Pair ${pair.code}</h1>
<h2>What was asked</h2><blockquote>${escaped(task.prompt)}</blockquote>
<h2>Constraints, written before any run</h2><ul>${constraints}</ul>
<h2>States</h2>
${states}
<h2>The changes</h2>
${diff("A", diffs.a)}
${diff("B", diffs.b)}
</body></html>
`;
};

/** What `writeKit` needs. */
export type KitRequest = {
  /** The work folder, holding `runs/`. */
  readonly work: string;
  /** Where `kit/` and `blind/` go. */
  readonly out: string;
  /** Where the key goes: never inside `out`, so the kit can be shared whole. */
  readonly keyFile: string;
  /** The key. */
  readonly key: BlindKey;
  /** Every run's measures, by id. */
  readonly runs: ReadonlyMap<string, RunMeasures>;
  /** The tasks, by id. */
  readonly tasks: ReadonlyMap<string, EvalTask>;
  /** How many judges get a sheet. */
  readonly judges: number;
  /** The judges' instructions, written in advance. */
  readonly instructions: string;
  /** The generator for the sheets' orders. */
  readonly random: Random;
};

/** Copies a run's pictures and judges' diff into a folder; gives the diff's text. */
const copyRun = async (work: string, side: PairSide, folder: string): Promise<string> => {
  const source = join(work, "runs", side.run);
  await mkdir(folder, { recursive: true });
  if (existsSync(join(source, "states")))
    await cp(join(source, "states"), join(folder, "states"), { recursive: true });
  const diff = readFileSync(join(source, "diff.patch"), "utf8");
  await writeFile(join(folder, "diff.patch"), diff);
  return diff;
};

/**
 * Writes the kit, the blinded runs and the key.
 *
 * @param request - the key, the runs and where.
 * @returns the key's fingerprint.
 */
export const writeKit = async (request: KitRequest): Promise<string> => {
  const { out, key, work } = request;
  for (const folder of ["kit", "blind"]) await rm(join(out, folder), { recursive: true, force: true });
  const keyText = `${JSON.stringify(key, null, 2)}\n`;
  const fingerprint = keyFingerprint(keyText);
  await mkdir(dirname(request.keyFile), { recursive: true });
  await writeFile(request.keyFile, keyText);
  for (const pair of key.pairs) {
    const task = request.tasks.get(pair.task);
    const a = request.runs.get(pair.a.run);
    const b = request.runs.get(pair.b.run);
    if (task === undefined || a === undefined || b === undefined)
      throw new Error(`pair ${pair.code} is incomplete`);
    const folder = join(out, "kit", "pairs", pair.code);
    const diffs = {
      a: await copyRun(work, pair.a, join(folder, "A")),
      b: await copyRun(work, pair.b, join(folder, "B"))
    };
    await writeFile(join(folder, "index.html"), pairPage(pair, task, a, b, diffs));
    if (pair.repeats !== undefined) continue;
    for (const [side, measures] of [
      [pair.a, a],
      [pair.b, b]
    ] as const) {
      const blind = join(out, "blind", "runs", side.code);
      await copyRun(work, side, blind);
      await writeFile(
        join(blind, "measures.json"),
        `${JSON.stringify(blindMeasures(measures, side.code), null, 2)}\n`
      );
    }
  }
  await mkdir(join(out, "kit", "sheets"), { recursive: true });
  for (let judge = 1; judge <= request.judges; judge += 1)
    await writeFile(
      join(out, "kit", "sheets", `judge-${judge}.csv`),
      judgeSheet(judge, key.pairs, request.random)
    );
  const index = key.pairs
    .map((pair) => `- [Pair ${pair.code}](pairs/${pair.code}/index.html)`)
    .sort()
    .join("\n");
  await writeFile(
    join(out, "kit", "README.md"),
    `${request.instructions.trimEnd()}\n\n## This kit\n\n${key.pairs.length} pairs, ${request.judges} sheets.\n` +
      `Key fingerprint (SHA-256 of key.json, kept by the organiser until every sheet is in): \`${fingerprint}\`\n\n${index}\n`
  );
  return fingerprint;
};
