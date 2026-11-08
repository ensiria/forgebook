/**
 * The catalogue as a file, for `forgebook mcp --from`: what its read-only tools answer with no dev server and no repository.
 *
 * @remarks
 * `forgebook build --agent-index` writes it beside the pages. It holds what the dev server's answers hold (stories, their
 * props and docs, tokens), and the links are made when it is read, since only the reader knows where the catalogue is
 * served. The questions run the code the dev server runs, so a built catalogue answers as a running one does.
 *
 * @module
 */
import type { UsageGuidance } from "../componentDocs.ts";
import type {
  AgentFoundComponent,
  FoundComponentsDocument,
  StoriesDocument,
  StoryDocument
} from "./agent.types.ts";
import { type CataloguePages, storyLinks } from "./agentApi.ts";
import type { AgentAnswer } from "./agentRoutes.ts";
import { type FindableComponent, findComponents } from "./findComponent.ts";
import { TOKEN_ANSWERS, type TokenReading } from "./tokenAnswers.ts";

/** A component as a search finds it, with what its answer carries. */
export type IndexedComponent = FindableComponent & {
  /** Its first story's id. */
  readonly story: string | undefined;
  /** When to use it and when not, when its TSDoc says. */
  readonly guidance?: UsageGuidance;
};

/** The file. */
export type AgentIndex = {
  /** The shape's version. */
  readonly schema: 1;
  /** The list of stories, with "Used in" where the catalogue offers it. */
  readonly stories: StoriesDocument;
  /** Each story in detail, by id. */
  readonly details: Readonly<Record<string, StoryDocument>>;
  /** What the intent search reads. */
  readonly findable: readonly IndexedComponent[];
  /** The tokens. */
  readonly tokens: TokenReading;
  /** The stories that could not be read when it was written. */
  readonly problems: readonly string[];
};

/**
 * Everything the index says went wrong while it was written, for whoever builds it: a story that failed to load is an
 * answer with problems, not a missing one.
 *
 * @param index - the file.
 */
export const indexProblems = (index: AgentIndex): readonly string[] => [
  ...index.problems,
  ...index.stories.problems,
  ...index.tokens.unread,
  ...index.tokens.problems,
  ...Object.entries(index.details).flatMap(([id, detail]) =>
    detail.problems.map((problem) => `${id}: ${problem}`)
  )
];

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a value is an index this version reads.
 *
 * @param value - the parsed file.
 */
export const isAgentIndex = (value: unknown): value is AgentIndex =>
  isRecord(value) &&
  value["schema"] === 1 &&
  isRecord(value["stories"]) &&
  isRecord(value["details"]) &&
  Array.isArray(value["findable"]) &&
  isRecord(value["tokens"]) &&
  Array.isArray(value["problems"]);

/** The list with the links of where the reader finds the catalogue, and "Used in" only when asked for. */
const storiesAnswer = (
  { stories }: AgentIndex,
  pages: CataloguePages,
  params: URLSearchParams
): AgentAnswer => {
  const view = params.get("view") ?? "";
  const isUsageAsked = params.get("usedIn") === "true";
  const components = stories.components.map(({ usedIn, ...component }) => ({
    ...component,
    ...(isUsageAsked && usedIn !== undefined ? { usedIn } : {}),
    stories: component.stories.map((story) => ({ ...story, links: storyLinks(pages, story.id, view) }))
  }));
  return { status: 200, body: { ...stories, components } };
};

/** One story, with the same links. */
const storyAnswer = (
  { details }: AgentIndex,
  pages: CataloguePages,
  params: URLSearchParams
): AgentAnswer => {
  const id = params.get("id") ?? "";
  const detail = Object.hasOwn(details, id) ? details[id] : undefined;
  if (detail === undefined) return { status: 404, body: { error: `No story "${id}"` } };
  const links = storyLinks(pages, id, params.get("view") ?? "");
  return { status: 200, body: { ...detail, story: { ...detail.story, links } } };
};

/** The components a description fits. */
const findAnswer = (
  { findable }: AgentIndex,
  pages: CataloguePages,
  params: URLSearchParams
): AgentAnswer => {
  const query = params.get("query") ?? "";
  if (query.trim() === "") return { status: 400, body: { error: "No words to look for" } };
  const components = findComponents(findable, query).map((found): AgentFoundComponent => {
    const component = findable.find((each) => each.id === found.id);
    const story = component?.story;
    return {
      ...found,
      story,
      links: story === undefined ? undefined : storyLinks(pages, story, ""),
      ...(component?.guidance === undefined ? {} : { guidance: component.guidance })
    };
  });
  const body: FoundComponentsDocument = { schema: 1, query, components };
  return { status: 200, body };
};

/**
 * Answers one of the API's paths from the file.
 *
 * @param index - the file.
 * @param pages - where the catalogue is served, for the links.
 * @param route - the path, as a dev server takes it.
 * @param params - the query.
 * @returns the same answer a dev server gives, or a 404 for what only a dev server can do.
 */
export const indexAnswer = (
  index: AgentIndex,
  pages: CataloguePages,
  route: string,
  params: URLSearchParams
): AgentAnswer => {
  if (route === "stories") return storiesAnswer(index, pages, params);
  if (route === "story") return storyAnswer(index, pages, params);
  if (route === "find") return findAnswer(index, pages, params);
  const tokenAnswer = Object.hasOwn(TOKEN_ANSWERS, route) ? TOKEN_ANSWERS[route] : undefined;
  if (tokenAnswer !== undefined) return tokenAnswer(index.tokens, params);
  return { status: 404, body: { error: `A built catalogue cannot answer "${route}"` } };
};
