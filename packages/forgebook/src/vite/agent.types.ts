/**
 * The documents the catalogue answers tools and agents with: the stories a catalogue has, and one story in detail.
 * The dev server makes them (`/__forgebook/api/`), `forgebook stories` and `forgebook story` print them, and
 * `forgebook mcp` hands them to an agent.
 *
 * @remarks
 * Each document carries `schema`, so a tool can refuse a shape it does not know; a change that breaks a reader bumps
 * it. Every story carries its links, so a person can open what a tool talks about in the same view.
 *
 * @module
 */
import type { ComponentDocs } from "../componentDocs.ts";
import type { LiveError } from "../liveErrors.ts";

/** The version of the documents' shape. */
export type AgentSchema = 1;

/** Where a story opens, in the view the answer describes. */
export type StoryLinks = {
  /** Its page in the catalogue (the shell, the story selected). */
  readonly address: string;
  /** Its frame alone: the story's own document, as the tests open it. */
  readonly frame: string;
};

/** A story, as the list of stories gives it. */
export type AgentStory = {
  /** `<source>:<title>--<export>` in kebab case: what `forgebook story` takes. */
  readonly id: string;
  /** The name the catalogue shows. */
  readonly name: string;
  /** The named export in the story file. */
  readonly exportName: string;
  /** What it shows and what to notice, from its TSDoc; none when it has none. */
  readonly description: string | undefined;
  /** Its tags, the meta's and its own. */
  readonly tags: readonly string[];
  /** Whether it is listed nowhere (`!dev`), opened only by its address. */
  readonly isUnlisted: boolean;
  /** The height its scene declares (`parameters.height`), in CSS px, when it declares one. */
  readonly height?: number;
  /** Where it opens. */
  readonly links: StoryLinks;
};

/** A component whose stories use another ("Used in"). */
export type AgentUsingComponent = {
  /** Its id, as `AgentComponent.id`. */
  readonly id: string;
  /** Its title. */
  readonly title: string;
  /** Whether one of its stories renders the component itself, not only through another component. */
  readonly isDirect: boolean;
  /** The ids of its stories that use the component. */
  readonly stories: readonly string[];
};

/** A component (a story file) and its stories. */
export type AgentComponent = {
  /** `<source>:<title>` in kebab case. */
  readonly id: string;
  /** Its whole title (`Inputs/Selection/Select`). */
  readonly title: string;
  /** The id of the source it belongs to. */
  readonly source: string;
  /** The story file, relative to the module that declares the source. */
  readonly file: string;
  /** Its stories: the listed ones in the catalogue's order, then the unlisted ones. */
  readonly stories: readonly AgentStory[];
  /**
   * The other components of its source whose stories use it, direct users first; only when asked for (it reads the
   * package's import graph) and the catalogue offers it.
   */
  readonly usedIn?: readonly AgentUsingComponent[];
};

/** A source of stories: a package's, or the project's own. */
export type AgentSource = {
  /** Its id, the first part of its stories' ids. */
  readonly id: string;
  /** The name the catalogue shows. */
  readonly name: string;
};

/** The stories a catalogue has, and what is wrong in their indexes. */
export type StoriesDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The catalogue's name. */
  readonly title: string;
  /** Its sources, in the catalogue's order. */
  readonly sources: readonly AgentSource[];
  /** Every component with its stories, in the catalogue's order. */
  readonly components: readonly AgentComponent[];
  /** One message per problem the index found (a title without a family, two files with the same title). */
  readonly problems: readonly string[];
};

/** One story in detail: what an agent needs to use it or to write the next one. */
export type StoryDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The story, with its links in the view asked for. */
  readonly story: AgentStory;
  /** Its component's id and title, and its "Used in" when the catalogue offers it. */
  readonly component: Pick<AgentComponent, "id" | "title" | "source" | "file" | "usedIn">;
  /**
   * The component's docs as the props panel reads them (its props, their types, defaults and TSDoc); none when the
   * story file names no component, or its docs could not be read (the reason is then in `problems`).
   */
  readonly docs: ComponentDocs | undefined;
  /** The story's args once its module ran, the meta's under its own; only what can be written as JSON. */
  readonly args: Readonly<Record<string, unknown>>;
  /** What went wrong while reading it: its module failing to load, its docs failing to be read. */
  readonly problems: readonly string[];
};

/** What the open frames reported while someone edited, and the story index's problems. */
export type ErrorsDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The errors after the number asked for, oldest first: render errors and failed plays. */
  readonly errors: readonly LiveError[];
  /** The number of the last error so far: ask for the errors since it next time. */
  readonly last: number;
  /** The story index's problems now (a broken story file, a title taken twice). */
  readonly problems: readonly string[];
};
