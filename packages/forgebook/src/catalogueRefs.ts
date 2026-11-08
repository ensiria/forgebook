/**
 * Another catalogue, already built and deployed, shown in this one's sidebar (`refs` in the configuration): where its
 * index and its stories are, and how its index reads.
 *
 * @remarks
 * A composed catalogue stays on its own origin. Its stories are shown through its own embed page (`?embed`), which
 * frames them on its own frames' origin and tells the page around it nothing but a height, so this catalogue never runs
 * its code and gives it nothing it could act on: the view's switches cross in the embed's address, read there as any
 * address is, and the panel's values never do. Its list comes from the index `forgebook build --agent-index` writes,
 * fetched only when its section is first opened. Pure, so the shell's lazy parts and the plugin share it.
 *
 * @module
 */
import { AGENT_INDEX_FILE } from "./agentIndexFile.ts";
import { EMBED_PARAMETER } from "./embed.ts";

/** A composed catalogue, as the configuration gives it and the shell reads it. */
export type CatalogueRef = {
  /** Its id, the configuration's key: in the address (`?ref=<id>&story=<id>`). */
  readonly id: string;
  /** Its name, as its section's heading. */
  readonly title: string;
  /** Its address, always ending in `/`, so its files resolve under it (`https://ds.example.com/catalogue/`). */
  readonly url: string;
};

/** A composed catalogue's id: lower-case words and digits, joined by dashes. */
const REF_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A story of a composed catalogue, as its index lists it. */
export type RefStory = {
  /** Its id in that catalogue. */
  readonly id: string;
  /** The name it shows. */
  readonly name: string;
};

/** A component of a composed catalogue, with its listed stories. */
export type RefComponent = {
  /** Its id in that catalogue. */
  readonly id: string;
  /** Its whole title (`Inputs/Select`). */
  readonly title: string;
  /** Its stories listed in the sidebar (unlisted ones left out), in that catalogue's order. */
  readonly stories: readonly RefStory[];
};

/** What the sidebar shows of a composed catalogue. */
export type RefIndex = {
  /** Its components, in its order; only those with a listed story. */
  readonly components: readonly RefComponent[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field of an object that is a list, or an empty one. */
const listAt = (value: Readonly<Record<string, unknown>>, name: string): readonly unknown[] => {
  const list = value[name];
  return Array.isArray(list) ? list : [];
};

/** A story of the index, when it is one the sidebar lists. */
const listedStory = (value: unknown): RefStory[] => {
  if (!isRecord(value) || value["isUnlisted"] === true) return [];
  const { id, name } = value;
  return typeof id === "string" && typeof name === "string" ? [{ id, name }] : [];
};

/** A component of the index, with its listed stories; nothing when it has none. */
const listedComponent = (value: unknown): RefComponent[] => {
  if (!isRecord(value)) return [];
  const { id, title } = value;
  const stories = listAt(value, "stories").flatMap(listedStory);
  return typeof id === "string" && typeof title === "string" && stories.length > 0
    ? [{ id, title, stories }]
    : [];
};

/**
 * What the sidebar shows of a composed catalogue's index, read from the parsed file.
 *
 * @param value - the parsed `forgebook-agent.json`.
 * @returns the index; none when the value is no index of a version this one reads.
 */
export const refIndexOf = (value: unknown): RefIndex | undefined => {
  if (!isRecord(value) || value["schema"] !== 1 || !isRecord(value["stories"])) return undefined;
  return { components: listAt(value["stories"], "components").flatMap(listedComponent) };
};

/**
 * The address of a composed catalogue's index.
 *
 * @param ref - the composed catalogue.
 */
export const refIndexAddress = (ref: CatalogueRef): string => new URL(AGENT_INDEX_FILE, ref.url).href;

/**
 * The address of a story in a composed catalogue's own page, to open it there.
 *
 * @param ref - the composed catalogue.
 * @param storyId - the story's id in it.
 */
export const refStoryAddress = (ref: CatalogueRef, storyId: string): string => {
  const address = new URL(ref.url);
  address.searchParams.set("story", storyId);
  return address.href;
};

/**
 * The address of a story alone in a composed catalogue's embed page, with this catalogue's switches.
 *
 * @remarks
 * Every switch is written, defaults included: the composed catalogue's default may be another value, and the story
 * shows what this catalogue's toolbar says. It keeps those it declares, with values it knows, and drops the others.
 *
 * @param ref - the composed catalogue.
 * @param storyId - the story's id in it.
 * @param switches - this catalogue's switches, by id, with the values the view gives them.
 */
export const refEmbedAddress = (
  ref: CatalogueRef,
  storyId: string,
  switches: Readonly<Record<string, string>>
): string => {
  const address = new URL(ref.url);
  address.searchParams.set(EMBED_PARAMETER, "");
  address.searchParams.set("story", storyId);
  for (const [id, value] of Object.entries(switches)) {
    // the story's own parameters stay the story's: a switch cannot take their place
    if (id !== EMBED_PARAMETER && id !== "story") address.searchParams.set(id, value);
  }
  return address.href;
};

/**
 * What is wrong with one composed catalogue of the configuration; nothing when it can be shown.
 *
 * @param id - its key.
 * @param value - what the configuration gives it.
 */
export const refProblem = (id: string, value: unknown): string | undefined => {
  if (!REF_ID.test(id))
    return `refs: "${id}" is not an id: write lower-case words and digits joined by dashes (design-system)`;
  if (!isRecord(value)) return `refs.${id} must be an object with a title and a url`;
  const { title, url } = value;
  if (typeof title !== "string" || title.trim() === "") return `refs.${id}.title is missing`;
  if (typeof url !== "string" || !URL.canParse(url))
    return `refs.${id}.url must be an absolute address (https://design.example.com/)`;
  const address = new URL(url);
  if (address.protocol !== "https:" && address.protocol !== "http:")
    return `refs.${id}.url must be an http or https address`;
  if (address.username !== "" || address.password !== "")
    return `refs.${id}.url must not hold credentials: the address is written into the page`;
  if (address.search !== "" || address.hash !== "")
    return `refs.${id}.url must be the catalogue's folder, with no query or fragment`;
  return undefined;
};

/**
 * A composed catalogue's address as the shell uses it: its folder, ending in `/`.
 *
 * @param url - the address the configuration gives, checked by `refProblem`.
 */
export const refFolder = (url: string): string => (url.endsWith("/") ? url : `${url}/`);
