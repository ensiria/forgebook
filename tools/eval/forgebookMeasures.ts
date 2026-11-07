/**
 * Forgebook's own verdicts on a change, taken in the measurement copy the same way for both arms: `verify` in every
 * variant, `check-code`, and the stress matrix on the task's probe stories.
 *
 * @remarks
 * Each is Forgebook's command line with `--json`, read defensively: the evaluation runs any release, and a release
 * without a command (the stress matrix is newer than some) gives the reason instead of a number, never a zero. The
 * readers are pure and take the commands' documents.
 *
 * @module
 */
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import type { RunMeasures } from "./eval.types.ts";
import { runCommand } from "./workspace.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A document's JSON, or nothing when it is not JSON. */
const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * `verify --json`'s verdict, or why it could not be read.
 *
 * @param text - what the command printed on stdout.
 */
export const verifyMeasure = (text: string): RunMeasures["verify"] => {
  const value = parsed(text);
  if (!isRecord(value) || typeof value["verdict"] !== "string") return "verify gave no verdict";
  return {
    verdict: value["verdict"],
    summary: typeof value["summary"] === "string" ? value["summary"] : "",
    problems: typeof value["problems"] === "number" ? value["problems"] : 0
  };
};

/**
 * `check-code --json`'s findings, counted by rule, or why they could not be read.
 *
 * @param text - what the command printed on stdout.
 */
export const checkCodeMeasure = (text: string): RunMeasures["checkCode"] => {
  const value = parsed(text);
  if (!isRecord(value) || !Array.isArray(value["problems"])) return "check-code gave no findings";
  const byRule: Record<string, number> = {};
  for (const problem of value["problems"]) {
    const rule = isRecord(problem) && typeof problem["rule"] === "string" ? problem["rule"] : "unknown";
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }
  return { problems: value["problems"].length, byRule };
};

/**
 * The stress matrix's report, counted: cases run, cases where something broke that the plain story does not show, and
 * cases that could not be judged.
 *
 * @param texts - what each `check <component> --stress --json` printed on stdout.
 */
export const stressMeasure = (texts: readonly string[]): RunMeasures["stress"] => {
  const reports = texts.map((text) => {
    const value = parsed(text);
    const report = isRecord(value) && isRecord(value["stress"]) ? value["stress"] : value;
    return isRecord(report) && Array.isArray(report["cases"]) ? report["cases"].filter(isRecord) : undefined;
  });
  if (reports.some((cases) => cases === undefined)) return "the stress matrix gave no report";
  const cases = reports.flatMap((each) => each ?? []);
  const notVerified = cases.filter((each) => typeof each["notVerified"] === "string");
  const broken = cases.filter(
    (each) =>
      typeof each["notVerified"] !== "string" &&
      Array.isArray(each["problems"]) &&
      each["problems"].length > 0
  );
  return { cases: cases.length, broken: broken.length, notVerified: notVerified.length };
};

/**
 * The components whose stories live in the probe files, from `stories --json`.
 *
 * @param text - what the command printed on stdout.
 * @param targets - the probes' paths in the clone.
 */
export const probeComponents = (text: string, targets: readonly string[]): string[] => {
  const value = parsed(text);
  if (!isRecord(value) || !Array.isArray(value["components"])) return [];
  const wanted = new Set(targets.map((target) => `./${target}`));
  return value["components"].flatMap((component) =>
    isRecord(component) &&
    typeof component["id"] === "string" &&
    typeof component["file"] === "string" &&
    wanted.has(component["file"])
      ? [component["id"]]
      : []
  );
};

/** What `forgebookMeasures` needs. */
export type ForgebookRequest = {
  /** The measurement copy, its change not committed. */
  readonly folder: string;
  /** Where `forgebook dev` answers. */
  readonly url: string;
  /** The probes' paths in the clone. */
  readonly probes: readonly string[];
  /** Variables every command of the app gets. */
  readonly env: Readonly<Record<string, string>>;
  /** Where each command's document is kept, for whoever reads the run later. */
  readonly keep: (name: string, text: string) => Promise<void>;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** How long one of Forgebook's checks may run, in milliseconds. */
const CHECK_TIMEOUT = 20 * 60_000;

/**
 * Runs Forgebook's verdicts on the change.
 *
 * @param request - the copy, the server and where to keep the documents.
 */
export const forgebookMeasures = async (
  request: ForgebookRequest
): Promise<Pick<RunMeasures, "verify" | "checkCode" | "stress">> => {
  const forgebook = join(request.folder, "node_modules", ".bin", "forgebook");
  const run = async (args: readonly string[], name: string): Promise<string> => {
    const text = await runCommand([forgebook, ...args, "--url", request.url, "--json"], {
      cwd: request.folder,
      io: request.io,
      env: request.env,
      timeoutMs: CHECK_TIMEOUT,
      // a red verdict exits 1, and is a measure like a green one
      check: false
    });
    await request.keep(name, text);
    return text;
  };
  const verify = verifyMeasure(await run(["verify", "--since", "HEAD"], "verify.json"));
  const checkCode = checkCodeMeasure(await run(["check-code", "--since", "HEAD"], "check-code.json"));
  if (request.probes.length === 0) return { verify, checkCode, stress: "the task has no probe story" };
  const components = probeComponents(await run(["stories"], "stories.json"), request.probes);
  if (components.length === 0) return { verify, checkCode, stress: "no probe story was listed" };
  const help = await runCommand([forgebook, "check", "--help"], {
    cwd: request.folder,
    io: request.io,
    env: request.env
  });
  if (!help.includes("--stress")) return { verify, checkCode, stress: "this Forgebook has no stress matrix" };
  const reports: string[] = [];
  for (const [index, component] of components.entries())
    reports.push(await run(["check", component, "--stress"], `stress-${index + 1}.json`));
  return { verify, checkCode, stress: stressMeasure(reports) };
};
