/**
 * What `forgebook check` and `forgebook shot` (and their MCP tools `check_story` and `story_shot`) run: the stories an
 * id names, opened in a browser in the views asked for, checked or pictured through `@forgebook/testing`, loaded from
 * the project.
 *
 * @remarks
 * The core has no browser: the testing package (and Playwright under it) is the project's, loaded from the catalogue's
 * folder only when a run starts, and named in the error when it is missing. An id is a story's, or a component's, which
 * stands for its listed stories. A view is written in the address's form or as words (`viewWords.ts`). The catalogue is
 * served over HTTP (the running dev server, or one of its own for the run), since a browser opens the frames.
 *
 * @module
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  isStoryCheckReport,
  isStoryShotReport,
  type SemanticModel,
  type StoryCheckReport,
  type StoryCheckRequest,
  type StoryShotReport
} from "../../src/storyCheck.ts";
import { catalogueSwitches, type ViewSwitch } from "../../src/switches.ts";
import { viewQuery } from "../../src/viewWords.ts";
import type { AgentStory, StoriesDocument } from "../../src/vite/agent.types.ts";
import { isStoriesDocument } from "../../src/vite/agentApi.ts";
import { AGENT_API } from "../../src/vite/agentRoutes.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { servedCatalogue } from "./agentClient.ts";

/** What the project installs to run the stories in a browser, and how. */
const INSTALL =
  "Stories run in a browser with @forgebook/testing: npm install -D @forgebook/testing @playwright/test, then npx playwright install chromium";

/** What a run is asked: the id, the views and whether to run every variant. */
export type StoryCheckInput = {
  /** A story's id, or a component's for its listed stories. */
  readonly id: string;
  /** The views, in the address's form or as words; none for the default view. */
  readonly views: readonly string[];
  /** Run every variant the catalogue's browser tests check. */
  readonly isAllVariants: boolean;
  /** Ask the configured model too: it sends each story's tree and picture to that address. */
  readonly isSemantic?: boolean;
};

/**
 * The stories an id names: the story itself, or a component's listed stories.
 *
 * @param document - the catalogue's stories.
 * @param id - the id.
 */
export const storiesNamed = (document: StoriesDocument, id: string): AgentStory[] => {
  const component = document.components.find((each) => each.id === id);
  if (component !== undefined) return component.stories.filter((story) => !story.isUnlisted);
  return document.components.flatMap((each) => each.stories.filter((story) => story.id === id));
};

/**
 * The views in the address's form, or why one cannot be read.
 *
 * @param views - the views as given.
 * @param switches - the catalogue's switches.
 */
const queriesOf = (views: readonly string[], switches: readonly ViewSwitch[]): string[] | string => {
  const queries: string[] = [];
  for (const view of views) {
    const read = viewQuery(view, switches);
    if ("error" in read) return read.error;
    queries.push(read.query);
  }
  return queries;
};

/**
 * A function the testing package exports, resolved from the catalogue's folder as the project's own code would: the
 * check, the pictures, the touch window.
 *
 * @param dir - the catalogue's folder.
 * @param specifier - its module (`@forgebook/testing/check`).
 * @param name - its name (`checkStories`).
 * @returns the function, or why it cannot be had.
 */
export const testingFunction = async (
  dir: string,
  specifier: string,
  name: string
): Promise<((request: unknown) => Promise<unknown>) | string> => {
  let resolved: string;
  try {
    resolved = createRequire(join(dir, "package.json")).resolve(specifier);
  } catch {
    return INSTALL;
  }
  const module: unknown = await import(pathToFileURL(resolved).href);
  if (typeof module !== "object" || module === null || !(name in module))
    return `${specifier} has no ${name}: update @forgebook/testing`;
  const found: unknown = Reflect.get(module, name);
  if (typeof found !== "function") return `${specifier}'s ${name} is not a function`;
  return async (request: unknown): Promise<unknown> => {
    const answer: unknown = await found(request);
    return answer;
  };
};

/**
 * The catalogue's stories, asked of its served address.
 *
 * @param origin - where it is served.
 */
const storiesAt = async (origin: string): Promise<StoriesDocument | string> => {
  const response = await fetch(`${origin}${AGENT_API}stories`);
  const body: unknown = await response.json();
  return isStoriesDocument(body) ? body : `The catalogue answered ${response.status} for its stories`;
};

/**
 * Runs one of the testing package's functions on the stories an id names, the catalogue served while it runs.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param input - the id, the views and whether to run every variant.
 * @param run - the function and what it adds to the request.
 * @returns its answer, or why it could not run.
 */
const runOnStories = async (
  config: ResolvedConfig,
  url: string | undefined,
  input: StoryCheckInput,
  run: {
    readonly specifier: string;
    readonly name: string;
    readonly extra: Readonly<Record<string, unknown>>;
  }
): Promise<unknown> => {
  const call = await testingFunction(config.dir, run.specifier, run.name);
  if (typeof call === "string") return call;
  const switches = catalogueSwitches(config.switches, config.languages, config.lists.controls);
  const views = queriesOf(input.views, switches);
  if (typeof views === "string") return views;
  const served = await servedCatalogue(config, url);
  try {
    const document = await storiesAt(served.origin);
    if (typeof document === "string") return document;
    const stories = storiesNamed(document, input.id);
    if (stories.length === 0) return `No story or component "${input.id}"`;
    const request: StoryCheckRequest = {
      frameUrl: `${served.origin}/frame.html`,
      stories: stories.map((story) => ({
        id: story.id,
        ...(story.height === undefined ? {} : { height: story.height }),
        ...(story.isLogic ? { isLogic: true } : {})
      })),
      switches,
      lists: config.lists,
      views,
      isAllVariants: input.isAllVariants
    };
    return await call({ ...request, ...run.extra });
  } finally {
    await served.close();
  }
};

/**
 * Runs the catalogue's checks.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param input - the id, the views and whether to check every variant.
 * @param model - the model `isSemantic` asks, or what to set to have one.
 * @returns the report, or why the check could not run.
 */
export const runStoryCheck = async (
  config: ResolvedConfig,
  url: string | undefined,
  input: StoryCheckInput,
  model?: SemanticModel | string
): Promise<StoryCheckReport | string> => {
  const semantic = input.isSemantic === true ? model : undefined;
  if (typeof semantic === "string") return semantic;
  const answer = await runOnStories(config, url, input, {
    specifier: "@forgebook/testing/check",
    name: "checkStories",
    extra: semantic === undefined ? {} : { semantic }
  });
  if (typeof answer === "string" || isStoryCheckReport(answer)) return answer;
  return "@forgebook/testing/check answered something that is not a check's report";
};

/**
 * Takes the stories' pictures.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param input - the id, the views and whether to picture every variant.
 * @param outDir - the folder the pictures go in, absolute.
 * @returns the pictures, or why they could not be taken.
 */
export const runStoryShot = async (
  config: ResolvedConfig,
  url: string | undefined,
  input: StoryCheckInput,
  outDir: string
): Promise<StoryShotReport | string> => {
  const answer = await runOnStories(config, url, input, {
    specifier: "@forgebook/testing/shot",
    name: "shotStories",
    extra: { outDir }
  });
  if (typeof answer === "string" || isStoryShotReport(answer)) return answer;
  return "@forgebook/testing/shot answered something that is not a picture run's report";
};

/**
 * Checks pages of an application.
 *
 * @param config - the catalogue's configuration: its accessibility rules, and the folder the testing package is in.
 * @param addresses - the pages' addresses.
 * @returns the report, or why the check could not run.
 */
export const runPageCheck = async (
  config: ResolvedConfig,
  addresses: readonly string[]
): Promise<StoryCheckReport | string> => {
  const check = await testingFunction(config.dir, "@forgebook/testing/check-page", "checkPages");
  if (typeof check === "string") return check;
  const answer = await check({ addresses, lists: config.lists });
  return isStoryCheckReport(answer)
    ? answer
    : "@forgebook/testing/check-page answered something that is not a report";
};
