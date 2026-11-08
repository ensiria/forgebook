/**
 * What the `forgebook` commands share: their common options, the command's name for hints, the catalogue's
 * configuration, an answer asked of the catalogue, and an answer printed.
 *
 * @module
 */
import { resolve } from "node:path";

import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import type {
  FoundComponentsDocument,
  NearestTokensDocument,
  PageDocument,
  PagesDocument,
  SearchDocument,
  StoriesDocument,
  StoryDocument,
  TokenDocument,
  TokensDocument
} from "../../src/vite/agent.types.ts";
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import {
  CONFIG_FILES,
  findConfigFile,
  loadConfigFile,
  type ResolvedConfig
} from "../../src/vite/configFile.ts";
import { emptyStoryGlobs, emptyStoryGlobsMessage } from "../../src/vite/emptyStoryGlobs.ts";
import { hiddenStoryFolders, hiddenStoryFoldersMessage } from "../../src/vite/hiddenStoryFiles.ts";
import { catalogueClient } from "./agentClient.ts";

/** The options every `forgebook` command takes: the configuration file. */
export type ForgebookOptions = {
  /** The configuration file. */
  readonly config: { readonly type: "string"; readonly valueName: string; readonly description: string };
};

/** The options every `forgebook` command takes. */
export const FORGEBOOK_OPTIONS: ForgebookOptions = {
  config: {
    type: "string",
    valueName: "file",
    description: "The configuration file; forgebook.config.ts in the current folder by default."
  }
};

/** The command, as the hints print it. */
export const COMMAND = "forgebook";

/**
 * The configuration file a command reads: the one given, or the one in the folder it runs in.
 *
 * @param file - the configuration file given; none to look in the current folder.
 * @returns its absolute path, or none when there is none here.
 */
export const configPathOf = (file: string | undefined): string | undefined =>
  file === undefined ? findConfigFile(process.cwd()) : resolve(file);

/**
 * The catalogue's configuration: the file given, or the one in the folder the command runs in.
 *
 * @param file - the configuration file given; none to look in the current folder.
 * @throws a `ScriptError` when there is none, or it cannot be used.
 */
export const configOf = async (file: string | undefined): Promise<ResolvedConfig> => {
  const found = configPathOf(file);
  if (found === undefined)
    throw new ScriptError(`No ${CONFIG_FILES[0]} here`, {
      hint: `Run ${COMMAND} in the catalogue's folder, or give --config`
    });
  try {
    return await loadConfigFile(found);
  } catch (error) {
    throw new ScriptError(error instanceof Error ? error.message : String(error));
  }
};

/**
 * The catalogue's configuration, for a command that reads its stories: a pattern that matches nothing is a mistake there,
 * and answering "no stories" with success hides it from a person and from CI alike. `forgebook dev` only warns, since
 * whoever runs it may be about to write the first story.
 *
 * @param file - the configuration file given; none to look in the current folder.
 * @throws a `ScriptError` when there is none, it cannot be used, or one of its story patterns matches nothing.
 */
export const configWithStoriesOf = async (file: string | undefined): Promise<ResolvedConfig> => {
  const config = await configOf(file);
  const globs = emptyStoryGlobs(config);
  if (globs.length > 0) {
    const hidden = hiddenStoryFolders(config);
    throw new ScriptError(emptyStoryGlobsMessage(globs), {
      hint:
        hidden.length > 0
          ? hiddenStoryFoldersMessage(hidden)
          : `Correct the pattern, or write the first story: ${COMMAND} new <component file>`
    });
  }
  return config;
};

/**
 * Asks the catalogue one of its answers, from its running dev server or one started for the answer.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param route - the answer (`stories`, `story`).
 * @param params - its query.
 * @param log - where to say where the answer comes from.
 * @throws a `ScriptError` when the catalogue answers with an error.
 */
export const askCatalogue = async (
  config: ResolvedConfig,
  url: string | undefined,
  route: string,
  params: URLSearchParams,
  log: Logger
): Promise<unknown> => {
  const client = await catalogueClient(config, url);
  log.debug(
    client.runningAt === undefined
      ? "No catalogue running: answered by a server of its own"
      : `Asked ${client.runningAt}`
  );
  let answer: AgentAnswer;
  try {
    answer = await client.ask(route, params);
  } finally {
    await client.close();
  }
  if (answer.status !== 200) {
    const { body } = answer;
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `The catalogue answered ${answer.status}`;
    throw new ScriptError(message);
  }
  return answer.body;
};

/**
 * Prints an answer, its JSON with `--json`, its problems as warnings, and ends with a failure when it has problems,
 * so a CI step fails on a broken story file.
 *
 * @param text - the answer as text for a terminal.
 * @param document - the answer as data.
 * @param problems - what is wrong in it.
 * @param context - the run's io, logger and `--json` mode.
 * @throws a reported `ScriptError` when there are problems.
 */
export const printAnswer = (
  text: string,
  document:
    | StoriesDocument
    | StoryDocument
    | TokensDocument
    | TokenDocument
    | NearestTokensDocument
    | FoundComponentsDocument
    | PagesDocument
    | PageDocument,
  problems: readonly string[],
  context: { readonly io: ScriptIo; readonly log: Logger; readonly isJson: boolean }
): void => {
  context.io.stdout.write(context.isJson ? formatJson(document) : `${text}\n`);
  for (const problem of problems) context.log.warn(problem);
  if (problems.length > 0)
    throw new ScriptError(`${problems.length} problems`, { exitCode: EXIT.failure, isReported: true });
};

/**
 * Prints an answer about tokens that holds whatever else is wrong in the files: the problems are warned about, and the
 * command succeeds, since a good answer must not read as a failure because of an unrelated token.
 *
 * @param text - the answer as a person reads it.
 * @param document - the answer.
 * @param context - where it goes.
 */
export const printTokenAnswer = (
  text: string,
  document: TokenDocument | NearestTokensDocument | SearchDocument,
  context: { readonly io: ScriptIo; readonly log: Logger; readonly isJson: boolean }
): void => {
  context.io.stdout.write(context.isJson ? formatJson(document) : `${text}\n`);
  for (const problem of document.problems) context.log.warn(problem);
};
