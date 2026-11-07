/**
 * What `forgebook new --repair` runs around the repair round (`newRepair.ts`): the stories checked in a browser through
 * the catalogue, the file written again with each round's wrappers, and what the command says and answers.
 *
 * @module
 */
import { existsSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import { EXIT } from "@ensiria/cli-kit/constants";
import { ScriptError } from "@ensiria/cli-kit/script";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { VITE_PATHS } from "../../src/vite/vitePaths.ts";
import { configOf } from "./catalogueCommands.ts";
import { type RepairOutcome, repairRounds } from "./newRepair.ts";
import type { StoryWrapper } from "./newStories.ts";
import { type NewStoriesFile, newStoriesDocument, newStoriesFile, usesWords } from "./newStoriesFile.ts";
import { runStoriesCheck } from "./storyCheckRun.ts";

/**
 * The catalogue a component's new stories are repaired in, when they can be: a wrapper is written as JSX, so only a
 * framework whose story files hold JSX takes one.
 *
 * @param written - the stories about to be written.
 * @param configFile - the configuration file given; none to look in the current folder.
 * @throws a `ScriptError` for a story file that holds no JSX, or a configuration that cannot be read.
 */
export const repairable = async (
  written: NewStoriesFile,
  configFile: string | undefined
): Promise<ResolvedConfig> => {
  if (!JSX_STORY_FILE.test(written.file))
    throw new ScriptError(
      `--repair draws stories inside providers as JSX, which ${written.file} cannot hold`,
      {
        hint: "Give the providers in a decorator of the file, or in the preview",
        exitCode: EXIT.usage
      }
    );
  return configOf(configFile);
};

/** A story file that holds JSX. */
const JSX_STORY_FILE = /\.stories\.[jt]sx$/;

/** What a run that found no story of the file says: the file is not listed, or does not load. */
const NO_STORY = /^No story or component /;

/**
 * Repairs a component's new stories.
 *
 * @param storyFile - the stories file written, absolute.
 * @param componentFile - the component's file, absolute.
 * @param config - the catalogue's configuration.
 * @param write - writes the stories again with wrappers.
 */
export const repairNew = async (
  storyFile: string,
  componentFile: string,
  config: ResolvedConfig,
  write: (wrappers: readonly StoryWrapper[]) => Promise<NewStoriesFile>
): Promise<RepairOutcome> => {
  const outcome = await repairRounds({
    componentFile,
    storyFile,
    packageDir: config.dir,
    check: () =>
      runStoriesCheck(config, undefined, {
        ids: [],
        files: [storyFile],
        isAllVariants: false,
        isOwnServer: true
      }),
    write: async (wrappers: readonly StoryWrapper[]): Promise<void> => {
      writeFileSync(storyFile, (await write(wrappers)).text);
    }
  });
  return typeof outcome.report === "string" && NO_STORY.test(outcome.report)
    ? {
        ...outcome,
        report: `the catalogue lists no story of ${VITE_PATHS.relative(config.dir, storyFile)}: its stories' patterns (${config.stories.join(", ")}) do not match it, or it does not load (npx forgebook stories --json says why)`
      }
    : outcome;
};

/**
 * What `new --json` answers: the file and its uses, and with `--repair` what the round added and found.
 *
 * @param written - the stories written.
 * @param shown - the file as the command names it.
 * @param repaired - the round's outcome, when one ran.
 */
export const newDocument = (
  written: NewStoriesFile,
  shown: string,
  repaired: RepairOutcome | undefined
): Readonly<Record<string, unknown>> => ({
  ...newStoriesDocument(written, shown),
  ...(repaired === undefined
    ? {}
    : {
        repair: {
          wrappers: repaired.wrappers.map((each) => each.name),
          notFound: repaired.notFound,
          ...(typeof repaired.report === "string"
            ? { notRun: repaired.report }
            : {
                stories: repaired.report.results.length,
                failing: repaired.report.results.filter((result) => result.problems.length > 0).length
              })
        }
      })
});

/**
 * What the command says of a repair round.
 *
 * @param repaired - the round's outcome.
 */
export const repairLines = (repaired: RepairOutcome): string[] => {
  const { report, wrappers, notFound } = repaired;
  if (typeof report === "string") return [`The stories were not drawn: ${report}`];
  const failing = report.results.filter((result) => result.problems.length > 0).length;
  return [
    ...(wrappers.length === 0 ? [] : [`Drawn inside ${wrappers.map((each) => each.name).join(", ")}`]),
    ...(notFound.length === 0
      ? []
      : [
          `Needs ${notFound.join(", ")}, which the application does not export as a component: give it in a decorator`
        ]),
    `${report.results.length - failing} of ${report.results.length} stories draw with no problem`
  ];
};

/** What `new` was given. */
export type NewOptions = {
  /** The component to read, when the file exports several. */
  readonly export?: string | undefined;
  /** The framework the stories are written for; the catalogue's when none. */
  readonly framework?: string | undefined;
  /** Print the file instead of writing it. */
  readonly print?: boolean | undefined;
  /** Replace a stories file that exists. */
  readonly force?: boolean | undefined;
  /** Draw the stories and repair them. */
  readonly repair?: boolean | undefined;
  /** The configuration file; the current folder's when none. */
  readonly config?: string | undefined;
};

/** What `new` prints: the file's text with `--print`, else the answer and the lines to log with their tone. */
export type NewOutcome = {
  /** The file's text, with `--print`. */
  readonly printed?: string;
  /** What `--json` answers. */
  readonly document: Readonly<Record<string, unknown>>;
  /** The lines to log, each with its tone. */
  readonly lines: readonly (readonly ["success" | "info" | "warn", string])[];
};

/**
 * Writes a component's first stories, and repairs them with `--repair`.
 *
 * @param componentFile - the component's file, absolute.
 * @param options - what the command was given.
 * @throws a `ScriptError` on a usage the command refuses, a file that exists without `--force`, or what writing the
 *   stories throws.
 */
export const runNew = async (componentFile: string, options: NewOptions): Promise<NewOutcome> => {
  if (options.print === true && options.repair === true)
    throw new ScriptError("--repair draws the file it writes, and --print writes none", {
      exitCode: EXIT.usage
    });
  const written = await newStoriesFile(componentFile, options.export, options.framework);
  // read first: a configuration that cannot be read must not leave a file written and the command failed
  const config = options.repair === true ? await repairable(written, options.config) : undefined;
  if (options.print === true) return { printed: written.text, document: {}, lines: [] };
  const shown = relative(process.cwd(), written.file);
  if (existsSync(written.file) && options.force !== true)
    throw new ScriptError(`${shown} exists`, { hint: "Give --force to replace it, or --print to see it" });
  writeFileSync(written.file, written.text);
  const repaired =
    config === undefined
      ? undefined
      : await repairNew(written.file, componentFile, config, (wrappers) =>
          newStoriesFile(componentFile, options.export, options.framework, wrappers)
        );
  const problemLines: NewOutcome["lines"] =
    written.usesProblem === undefined ? [] : [["warn", `Its uses were not read: ${written.usesProblem}`]];
  const title = written.text.match(/title: "([^"]*)"/)?.[1] ?? "";
  return {
    document: newDocument(written, shown, repaired),
    lines: [
      ["success", `${shown} written${usesWords(written.uses)}`],
      ...problemLines,
      ...(repaired === undefined
        ? []
        : repairLines(repaired).map((line): ["info", string] => ["info", line])),
      ["info", `npx forgebook stories --component ${title} lists them`]
    ]
  };
};
