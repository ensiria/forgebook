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

import { type DeviceDefault, deviceDefaultOf, NO_DEVICE } from "../../src/deviceView.ts";
import {
  isStoryCheckReport,
  isStoryDiffReport,
  isStoryShotReport,
  type SemanticModel,
  type StoryCheckReport,
  type StoryCheckRequest,
  type StoryCheckStory,
  type StoryDiffReport,
  type StoryDiffRequest,
  type StoryShotReport
} from "../../src/storyCheck.ts";
import { formerComponentId } from "../../src/storyTree.ts";
import { catalogueSwitches, type ViewSwitch } from "../../src/switches.ts";
import { viewQuery } from "../../src/viewWords.ts";
import type { AgentComponent, AgentStory, StoriesDocument } from "../../src/vite/agent.types.ts";
import { isStoriesDocument } from "../../src/vite/agentApi.ts";
import { formerIdOf, namedComponent, namedStory } from "../../src/vite/agentIds.ts";
import { AGENT_API } from "../../src/vite/agentRoutes.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { servedCatalogue } from "./agentClient.ts";

/** What the project installs to run the stories in a browser, and how. */
const INSTALL =
  "Stories run in a browser with @forgebook/testing: npm install -D @forgebook/testing @playwright/test, then npx playwright install chromium";

/** How many pages a run on several stories opens at once: enough to matter, few enough for a laptop or a CI runner. */
const STORIES_AT_ONCE = 4;

/** What a run on several stories is asked: their ids, and whether to run every variant. */
export type StoriesCheckInput = {
  /** The stories' ids. */
  readonly ids: readonly string[];
  /** Run every variant the catalogue's browser tests check; else the default view. */
  readonly isAllVariants: boolean;
};

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
 * A story of the document as a check reads it.
 *
 * @param component - its component.
 * @param story - the story.
 * @param catalogueDevice - the catalogue's default device, under the story's.
 */
const checkedStory = (
  component: AgentComponent,
  story: AgentStory,
  catalogueDevice: DeviceDefault
): StoryCheckStory => {
  const formerId = formerIdOf(component, story);
  return {
    id: story.id,
    file: story.file,
    ...(formerId === undefined ? {} : { formerId }),
    ...(story.height === undefined ? {} : { height: story.height }),
    ...(story.isLogic ? { isLogic: true } : {}),
    ...(deviceDefaultOf(catalogueDevice, story.device).isEdgeToEdge ? { isEdgeToEdge: true } : {})
  };
};

/**
 * The stories an id names, as a check reads them: the story itself, or a component's listed stories; by their ids, or
 * by the ids an earlier rule gave them.
 *
 * @param document - the catalogue's stories.
 * @param id - the id.
 * @param catalogueDevice - the catalogue's default device; none by default.
 */
export const storiesNamed = (
  document: StoriesDocument,
  id: string,
  catalogueDevice: DeviceDefault = NO_DEVICE
): StoryCheckStory[] => {
  const component = namedComponent(document, id);
  if (component !== undefined)
    return component.stories
      .filter((story) => !story.isUnlisted)
      .map((story) => checkedStory(component, story, catalogueDevice));
  const named = namedStory(document, id);
  return named === undefined ? [] : [checkedStory(named.component, named.story, catalogueDevice)];
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
  input: StoryCheckInput | (StoriesCheckInput & { readonly views?: undefined }),
  run: {
    readonly specifier: string;
    readonly name: string;
    readonly extra: (document: StoriesDocument) => Readonly<Record<string, unknown>>;
    /** The server to use and no other: a comparison must not draw one side from a server of its own. */
    readonly exactOrigin?: string;
  }
): Promise<unknown> => {
  const call = await testingFunction(config.dir, run.specifier, run.name);
  if (typeof call === "string") return call;
  const switches = catalogueSwitches(config.switches, config.languages, config.lists.controls);
  const views = queriesOf(input.views ?? [], switches);
  if (typeof views === "string") return views;
  const served =
    run.exactOrigin === undefined
      ? await servedCatalogue(config, url)
      : { origin: run.exactOrigin, close: async (): Promise<void> => undefined };
  try {
    const document = await storiesAt(served.origin);
    if (typeof document === "string") return document;
    const ids = "ids" in input ? input.ids : [input.id];
    const stories = ids.flatMap((id) =>
      storiesNamed(document, id, deviceDefaultOf(NO_DEVICE, config.lists.device))
    );
    if (stories.length === 0) return `No story or component "${ids.join(", ")}"`;
    const request: StoryCheckRequest = {
      frameUrl: `${served.origin}/frame.html`,
      stories,
      switches,
      lists: config.lists,
      views,
      isAllVariants: input.isAllVariants
    };
    return await call({
      ...request,
      ...("ids" in input ? { concurrency: STORIES_AT_ONCE } : {}),
      ...run.extra(document)
    });
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
    extra: () => (semantic === undefined ? {} : { semantic })
  });
  if (typeof answer === "string" || isStoryCheckReport(answer)) return answer;
  return "@forgebook/testing/check answered something that is not a check's report";
};

/**
 * Runs the catalogue's checks on several stories, on one browser and one server: what `verify` asks.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param input - the stories, and whether to check every variant.
 * @returns the report, or why the check could not run.
 */
export const runStoriesCheck = async (
  config: ResolvedConfig,
  url: string | undefined,
  input: StoriesCheckInput
): Promise<StoryCheckReport | string> => {
  const answer = await runOnStories(config, url, input, {
    specifier: "@forgebook/testing/check",
    name: "checkStories",
    extra: () => ({})
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
    extra: () => ({ outDir })
  });
  if (typeof answer === "string" || isStoryShotReport(answer)) return answer;
  return "@forgebook/testing/shot answered something that is not a picture run's report";
};

/**
 * The component a comparison names, by its current id and the one the former rule gave it, so its baselines under
 * either are its own; none when the id names a story.
 *
 * @param document - the catalogue's stories.
 * @param id - the id asked for, current or former.
 */
export const diffedComponent = (
  document: StoriesDocument,
  id: string
): Pick<StoryDiffRequest, "component" | "formerComponent"> => {
  const component = namedComponent(document, id);
  if (component === undefined) return {};
  const former = formerComponentId(component.source, component.title);
  return { component: component.id, ...(former === component.id ? {} : { formerComponent: former }) };
};

/**
 * Compares the stories' pictures with their baselines.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param input - the id, the views and whether to compare every variant.
 * @param folders - the baselines' folder and the one the new pictures go in, absolute.
 * @returns the results, or why they could not be had.
 */
export const runStoryDiff = async (
  config: ResolvedConfig,
  url: string | undefined,
  input: StoryCheckInput,
  folders: { readonly baselines: string; readonly outDir: string }
): Promise<StoryDiffReport | string> => {
  const answer = await runOnStories(config, url, input, {
    specifier: "@forgebook/testing/diff",
    name: "diffStories",
    extra: (document: StoriesDocument) => ({ ...folders, ...diffedComponent(document, input.id) })
  });
  if (typeof answer === "string" || isStoryDiffReport(answer)) return answer;
  return "@forgebook/testing/diff answered something that is not a comparison's report";
};

/**
 * Takes several stories' pictures from one server and no other: what `proof` asks of each side.
 *
 * @param config - the catalogue's configuration, whose testing package and switches both sides are drawn with.
 * @param origin - the server.
 * @param input - the stories, and whether to picture every variant.
 * @param outDir - the folder the pictures go in, absolute.
 * @returns the pictures, or why they could not be taken.
 */
export const runStoriesShot = async (
  config: ResolvedConfig,
  origin: string,
  input: StoriesCheckInput,
  outDir: string
): Promise<StoryShotReport | string> => {
  const answer = await runOnStories(config, origin, input, {
    specifier: "@forgebook/testing/shot",
    name: "shotStories",
    exactOrigin: origin,
    extra: () => ({ outDir })
  });
  if (typeof answer === "string" || isStoryShotReport(answer)) return answer;
  return "@forgebook/testing/shot answered something that is not a picture run's report";
};

/**
 * Compares several stories' pictures with a folder of pictures, from one server and no other: what `proof` asks of the
 * change.
 *
 * @param config - the catalogue's configuration.
 * @param origin - the server.
 * @param input - the stories, and whether to compare every variant.
 * @param folders - the pictures to compare with and the folder the new ones go in, absolute.
 * @returns the results, or why they could not be had.
 */
export const runStoriesDiff = async (
  config: ResolvedConfig,
  origin: string,
  input: StoriesCheckInput,
  folders: { readonly baselines: string; readonly outDir: string }
): Promise<StoryDiffReport | string> => {
  const answer = await runOnStories(config, origin, input, {
    specifier: "@forgebook/testing/diff",
    name: "diffStories",
    exactOrigin: origin,
    extra: () => folders
  });
  if (typeof answer === "string" || isStoryDiffReport(answer)) return answer;
  return "@forgebook/testing/diff answered something that is not a comparison's report";
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
