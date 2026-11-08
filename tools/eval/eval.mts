#!/usr/bin/env node
/**
 * The `eval` command: whether a coding agent with Forgebook does better UI work than without, on real open source apps,
 * measured by machine and scored blind by people. See its README for the method.
 *
 * @module
 */
import { randomInt } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { defineCommands } from "@ensiria/cli-kit/commands";
import { table } from "@ensiria/cli-kit/layout";
import { ScriptError, usageError } from "@ensiria/cli-kit/script";

import { writeKit } from "./blindKit.ts";
import { blindPairs } from "./blindPairs.ts";
import type { EvalTask, RunMeasures } from "./eval.types.ts";
import { summariseMeasures } from "./measuresSummary.ts";
import { type Random, seeded } from "./random.ts";
import { EVAL_FOLDER, readDefinitions, readProfile, runEvaluation, STAND_IN } from "./runEval.ts";
import { checkedRatings, parseSheet, scoreReport } from "./score.ts";
import { plannedSample } from "./stats.ts";
import { parseKey, parseMeasures } from "./storedDocuments.ts";

/** The repository's root, from this file. */
const REPOSITORY = resolve(import.meta.dirname, "../..");

/** The work folder when none is given: beside the repository, never inside it. */
const DEFAULT_WORK = join(REPOSITORY, "..", "forgebook-eval");

/** Every run's measures in a work folder. */
const measuredRuns = (work: string): RunMeasures[] => {
  const runs = join(work, "runs");
  if (!existsSync(runs)) return [];
  return readdirSync(runs).flatMap((id): RunMeasures[] => {
    const file = join(runs, id, "measures.json");
    return existsSync(file) ? [parseMeasures(readFileSync(file, "utf8"), file)] : [];
  });
};

/**
 * The tasks `--task` names, every task when it names none.
 *
 * @throws a usage error naming the ids that are no task.
 */
const chosenTasks = (tasks: readonly EvalTask[], ids: readonly string[]): readonly EvalTask[] => {
  const unknown = ids.filter((id) => !tasks.some((task) => task.id === id));
  if (unknown.length > 0) throw usageError(`unknown --task: ${unknown.join(", ")}`);
  return ids.length === 0 ? tasks : tasks.filter((task) => ids.includes(task.id));
};

/**
 * The work folder `--work` names, or the default one.
 *
 * @throws a usage error when it is inside the repository, whose checks and Git would see the clones.
 */
const outsideWork = (option: string | undefined): string => {
  const work = resolve(option ?? DEFAULT_WORK);
  if (work === REPOSITORY || work.startsWith(`${REPOSITORY}/`))
    throw usageError("--work must be outside the repository");
  return work;
};

/** Numbers no seed predicts, for the blinding's codes and sides and the sheets' orders. */
const unpredictable: Random = () => randomInt(0, 2 ** 47) / 2 ** 47;

/** A number with two decimals, or a dash. */
const fixed = (value: number): string => (Number.isNaN(value) ? "–" : value.toFixed(2));

await defineCommands({
  name: "eval",
  command: "node tools/eval/eval.mts",
  summary: "Measure whether a coding agent does better UI work with Forgebook than without, on real apps.",
  icon: "check",
  json: true,
  options: {
    work: {
      type: "string",
      valueName: "folder",
      description: "Where clones, runs and results go, outside the repository; beside it by default."
    },
    seed: {
      type: "number",
      default: 1,
      integer: true,
      description: "The seed of the runs' order and of the bootstrap; never of the blinding."
    }
  },
  commands: (evaluation) => ({
    tasks: evaluation.command({
      summary: "Check every app and task definition, and list the tasks.",
      run: ({ io, isJson, style }) => {
        const { apps, tasks } = readDefinitions();
        const rows = tasks.map((task) => [
          task.id,
          task.app,
          String(task.states.length),
          String(task.acceptance.length),
          String(task.probes.length)
        ]);
        if (!isJson)
          io.stdout.write(
            `${table(rows, { columns: ["task", "app", "states", "acceptance", "probes"].map((header) => ({ header })) }, style)}\n`
          );
        return { apps: [...apps.keys()], tasks: tasks.map((task) => ({ id: task.id, app: task.app })) };
      }
    }),
    run: evaluation.command({
      summary: "Run the agent on the tasks in both arms, and measure each run.",
      options: {
        agent: {
          type: "string",
          required: true,
          valueName: "name-or-file",
          description: `The agent's profile: a name under tools/eval/agents (${STAND_IN} needs no model), or a file.`
        },
        task: {
          type: "string",
          multiple: true,
          valueName: "id",
          description: "Only these tasks; every task by default."
        },
        repeats: {
          type: "number",
          default: 3,
          integer: true,
          min: 1,
          description: "Runs of each task in each arm."
        },
        port: {
          type: "number",
          default: 6200,
          integer: true,
          description: "The first of three ports a measurement takes: the app's, Forgebook's, its frames'."
        },
        "forgebook-version": {
          type: "string",
          valueName: "version",
          description:
            "Evaluate the published release of this forgebook version, each other package at its version in that release, instead of this checkout, packed."
        },
        fresh: { type: "boolean", description: "Run again the runs already measured." },
        keep: { type: "boolean", description: "Keep each run's copies of the app, to look into a run." }
      },
      examples: [
        {
          command: "eval run --agent dry-run --task apps-empty-state --repeats 1",
          description: "The pipeline, no model."
        },
        {
          command: "eval run --agent claude-code --work /tmp/eval",
          description: "Every task, three times in each arm."
        }
      ],
      run: async ({ options, io, log, onExit }) => {
        const { apps, tasks } = readDefinitions();
        const chosen = chosenTasks(tasks, options.task);
        const work = outsideWork(options.work);
        await mkdir(work, { recursive: true });
        const profile = readProfile(options.agent);
        onExit(() => log.info(`Runs so far are in ${join(work, "runs")}`));
        const ends = await runEvaluation({
          tasks: chosen,
          apps,
          profile,
          repeats: options.repeats,
          seed: options.seed,
          work,
          repository: REPOSITORY,
          ...(options["forgebook-version"] === undefined ? {} : { version: options["forgebook-version"] }),
          port: options.port,
          isFresh: options.fresh,
          isKept: options.keep,
          onStep: (message) => log.info(message),
          io
        });
        const failed = ends.filter((end) => end.kind === "failed");
        for (const end of failed) if (end.kind === "failed") log.error(`${end.id}: ${end.reason}`);
        log.info(`${ends.length - failed.length} of ${ends.length} runs measured, in ${join(work, "runs")}`);
        // the runs that ended are a result too: the document lists them, and the exit code says some failed
        if (failed.length > 0) io.setExitCode(1);
        return { work, runs: ends.map((end) => ({ id: end.id, kind: end.kind })) };
      }
    }),
    blind: evaluation.command({
      summary: "Make the judges' kit from the measured runs: blinded pairs, sheets, and the key kept apart.",
      options: {
        out: {
          type: "string",
          valueName: "folder",
          description: "Where kit/, blind/ and key/ go; <work>/judging by default."
        },
        judges: {
          type: "number",
          default: 5,
          integer: true,
          min: 1,
          description: "How many judges get a sheet."
        },
        duplicates: {
          type: "number",
          default: 2,
          integer: true,
          min: 0,
          description: "Pairs shown twice with sides swapped, to measure each judge's consistency."
        }
      },
      run: async ({ options, log }) => {
        const work = outsideWork(options.work);
        const runs = measuredRuns(work);
        if (runs.length === 0) throw new ScriptError(`no measured run in ${join(work, "runs")}`);
        const builds = new Set(runs.map((run) => `${run.agent} on Forgebook ${run.forgebook}`));
        if (builds.size > 1)
          throw new ScriptError(`the runs mix agents or Forgebook builds: ${[...builds].join("; ")}`, {
            hint: "Give each agent and build a --work of its own"
          });
        const { tasks } = readDefinitions();
        const repeats = Math.max(...runs.map((run) => run.repeat));
        // never from the seed: a judge who knew the generator could search the seeds until the codes matched
        const random = unpredictable;
        const key = blindPairs(
          runs,
          // the tasks this evaluation ran: a task never started is not a missing pair
          tasks.filter((task) => runs.some((run) => run.task === task.id)).map((task) => task.id),
          repeats,
          options.duplicates,
          random
        );
        for (const left of key.excluded)
          log.warn(`${left.task} repeat ${left.repeat} left out: ${left.reason}`);
        const out = resolve(options.out ?? join(work, "judging"));
        const keyFile = join(work, "key", "key.json");
        const fingerprint = await writeKit({
          work,
          out,
          keyFile,
          key,
          runs: new Map(runs.map((run) => [run.id, run])),
          tasks: new Map(tasks.map((task) => [task.id, task])),
          judges: options.judges,
          instructions: readFileSync(join(EVAL_FOLDER, "judges", "instructions.md"), "utf8"),
          random
        });
        log.info(`Kit in ${join(out, "kit")}; keep ${keyFile} away from the judges`);
        return {
          kit: join(out, "kit"),
          key: keyFile,
          fingerprint,
          pairs: key.pairs.length
        };
      }
    }),
    score: evaluation.command({
      summary: "Read the judges' sheets against the key, and the automatic measures, into the result.",
      options: {
        key: {
          type: "string",
          required: true,
          valueName: "file",
          description: "The key, <work>/key/key.json."
        },
        sheets: {
          type: "string",
          required: true,
          valueName: "folder",
          description: "The judges' filled sheets (.csv)."
        }
      },
      run: async ({ options, io, log, isJson }) => {
        const key = parseKey(readFileSync(options.key, "utf8"), options.key);
        const files = readdirSync(options.sheets).filter((file) => file.endsWith(".csv"));
        const sheets = files.map((file) =>
          parseSheet(readFileSync(join(options.sheets, file), "utf8"), file)
        );
        for (const problem of sheets.flatMap((sheet) => sheet.problems)) log.warn(problem);
        const checked = checkedRatings(
          key,
          sheets.flatMap((sheet) => sheet.ratings)
        );
        for (const problem of checked.problems) log.warn(problem);
        const ratings = checked.ratings;
        const random = seeded(options.seed);
        const judges = scoreReport(key, ratings, random);
        const work = outsideWork(options.work);
        const runs = measuredRuns(work);
        const measures = summariseMeasures(runs, random);
        // a diff with the tool's name taken out may still hint at its arm: those pairs are named, to be read apart
        const redacted = new Set(runs.filter((run) => run.redactions > 0).map((run) => run.id));
        const redactedPairs = key.pairs
          .filter((pair) => redacted.has(pair.a.run) || redacted.has(pair.b.run))
          .map((pair) => pair.code);
        // a run that failed is in no pair and no mean: how many failed in each arm is part of the result
        const failed = existsSync(join(work, "runs"))
          ? readdirSync(join(work, "runs")).filter((id) => existsSync(join(work, "runs", id, "failed.txt")))
          : [];
        const failures = {
          with: failed.filter((id) => id.includes("--with--")).length,
          without: failed.filter((id) => id.includes("--without--")).length
        };
        const result = { judges, measures, failures, redactedPairs };
        await writeFile(join(work, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
        if (!isJson) {
          const { overall, winRate, agreement, blinding } = judges;
          io.stdout.write(
            `overall ${fixed(overall.value)} [${fixed(overall.low)}, ${fixed(overall.high)}] p=${fixed(overall.p)}\n` +
              `win rate ${fixed(winRate.value)} [${fixed(winRate.low)}, ${fixed(winRate.high)}]\n` +
              `agreement (alpha) ${fixed(agreement)}; arm guessed right ${fixed(blinding.value)} of guesses\n`
          );
        }
        return result;
      }
    }),
    plan: evaluation.command({
      summary: "Say how many tasks, pairs and judges a result needs to be told from no effect.",
      options: {
        "win-rate": {
          type: "number",
          default: 0.65,
          min: 0.51,
          max: 0.99,
          description: "The win rate to detect."
        },
        icc: {
          type: "number",
          default: 0.3,
          min: 0,
          max: 1,
          description: "How alike two repeats of one task are."
        },
        repeats: {
          type: "number",
          default: 3,
          integer: true,
          min: 1,
          description: "Runs of each task in each arm."
        },
        alpha: {
          type: "number",
          default: 0.05,
          min: 0.001,
          max: 0.5,
          description: "The test's level, two-sided."
        },
        power: {
          type: "number",
          default: 0.8,
          min: 0.5,
          max: 0.99,
          description: "The chance of seeing a real effect."
        },
        judges: {
          type: "number",
          default: 5,
          integer: true,
          min: 3,
          description: "Judges, each scoring every pair."
        },
        minutes: { type: "number", default: 4, min: 1, description: "Minutes a judge spends on a pair." }
      },
      run: ({ options, io, isJson }) => {
        const plan = plannedSample({
          winRate: options["win-rate"],
          alpha: options.alpha,
          power: options.power,
          icc: options.icc,
          repeats: options.repeats
        });
        const hours = (plan.pairs * options.minutes) / 60;
        if (!isJson)
          io.stdout.write(
            `${plan.tasks} tasks × ${options.repeats} repeats = ${plan.pairs} pairs ` +
              `(${plan.independentPairs} if independent); ${options.judges} judges, about ${hours.toFixed(1)} h each\n`
          );
        return { ...plan, judges: options.judges, hoursPerJudge: hours };
      }
    })
  })
}).run();
