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

import type { ComponentDocs, UsageGuidance } from "../componentDocs.ts";
import type { LiveError } from "../liveErrors.ts";
import type { CodeProblem, CodeRule } from "./checkCode.ts";
import type { DesignToken } from "./designTokens.ts";
import type { FoundComponent } from "./findComponent.ts";
import type { NearestTokens } from "./nearestToken.ts";

/** The version of the documents' shape. */
export type AgentSchema = 1;

/** Where a story opens, in the view the answer describes. */
export type StoryLinks = {
  /** Its page in the catalogue (the shell, the story selected). */
  readonly address: string;
  /** Its frame alone: the story's own document, as the tests open it. */
  readonly frame: string;
};

/** A design's place in Figma: what to give a person, or a tool that reads Figma. */
export type AgentDesignLink = {
  /** The link that opens it in Figma. */
  readonly figma: string;
  /** The file's key. */
  readonly fileKey: string;
  /** The branch's key, for a link to a branch of the file. */
  readonly branchKey?: string;
  /** The node, as Figma's API writes it (`12:34`); none for a link to the whole file. */
  readonly nodeId?: string;
};

/** A story's design: its place in Figma, and where a person sees it beside the story. */
export type AgentDesign = AgentDesignLink & {
  /** The story's page in the catalogue, on its Design tab (on its first tab where the catalogue turned that one off). */
  readonly address: string;
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
  /** Whether it is about logic, not looks (`parameters.logic`): a hook's or a function's scene. */
  readonly isLogic: boolean;
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
  /** Its design (the meta's `parameters.design.figma`), when it has one. */
  readonly design?: AgentDesignLink;
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
  readonly component: Pick<AgentComponent, "id" | "title" | "source" | "file" | "design" | "usedIn">;
  /**
   * The component's docs as the props panel reads them (its props, their types, defaults and TSDoc); none when the
   * story file names no component, or its docs could not be read (the reason is then in `problems`).
   */
  readonly docs: ComponentDocs | undefined;
  /** Its design: its own `parameters.design.figma`, else its component's; none when it has none. */
  readonly design?: AgentDesign;
  /** The story's args once its module ran, the meta's under its own; only what can be written as JSON. */
  readonly args: Readonly<Record<string, unknown>>;
  /** What went wrong while reading it: its module failing to load, its docs failing to be read. */
  readonly problems: readonly string[];
};

/** A token in a list: what to write, without what a list does not need. */
export type AgentTokenSummary = Pick<
  DesignToken,
  "name" | "type" | "value" | "modes" | "deprecated" | "isThemeOnly"
>;

/** The catalogue's tokens: how many, and the first of them, since agents degrade on long answers. */
export type TokensDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** Whether the catalogue names a tokens file at all. */
  readonly isConfigured: boolean;
  /** How many tokens match, whatever the limit. */
  readonly total: number;
  /** How many of each type. */
  readonly types: Readonly<Record<string, number>>;
  /** The tokens, up to the limit asked for, in the files' order. */
  readonly tokens: readonly AgentTokenSummary[];
  /** What in the tokens files could not be read. */
  readonly problems: readonly string[];
};

/** One token, with all that is known of it. */
export type TokenDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The token. */
  readonly token: DesignToken;
  /** What in the tokens files could not be read. */
  readonly problems: readonly string[];
};

/** The tokens nearest a value written by hand. */
export type NearestTokensDocument = NearestTokens & {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The value asked about. */
  readonly value: string;
  /** What in the tokens files could not be read. */
  readonly problems: readonly string[];
};

/** A component an intent search found, with what a next step needs. */
export type AgentFoundComponent = FoundComponent & {
  /** Its first story's id, to pass to `story`. */
  readonly story: string | undefined;
  /** The links that open that story. */
  readonly links: StoryLinks | undefined;
  /** When to use it and when not, when its TSDoc says. */
  readonly guidance?: UsageGuidance;
};

/** The components a query describes. */
export type FoundComponentsDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The query. */
  readonly query: string;
  /** Up to five, best first; none means nothing in the catalogue holds those words. */
  readonly components: readonly AgentFoundComponent[];
};

/** A story a change touches. */
export type AgentChangedStory = {
  /** Its id. */
  readonly id: string;
  /** Its component's title. */
  readonly title: string;
  /** The links that open it. */
  readonly links: StoryLinks;
};

/** The stories a change touches. */
export type ChangedStoriesDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** What the change is measured from. */
  readonly since: string;
  /** The files changed, relative to the repository. */
  readonly files: readonly string[];
  /** The stories that reach them. */
  readonly stories: readonly AgentChangedStory[];
  /** What could not be read: a group whose usage failed. */
  readonly problems: readonly string[];
};

/** What a change adds that breaks the design system. */
export type CheckedCodeDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** What the change is measured from. */
  readonly since: string;
  /** What was checked. Props, imports and deprecated components never are: a clean answer says no more than this. */
  readonly checked: readonly CodeRule[];
  /** What was not, and why: an agent must not read an empty list as all clear when these were skipped. */
  readonly skipped: readonly string[];
  /** What it found, by file and line. */
  readonly problems: readonly CodeProblem[];
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
