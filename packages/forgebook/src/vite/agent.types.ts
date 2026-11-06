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

import type { StoryDeviceSetting } from "@forgebook/story-format/csf";

import type { ComponentDocs, UsageGuidance } from "../componentDocs.ts";
import type { DocHeading } from "../docPages.ts";
import type { LiveError } from "../liveErrors.ts";
import type { PluginCondition } from "../plugin.ts";
import type { SearchHitKind, SearchReason, SearchResult } from "../search.ts";
import type { SetArgs, StoryControl } from "../storyControls.ts";
import type { CodeProblem, CodeRule } from "./checkCode.ts";
import type { DesignToken } from "./designTokens.ts";
import type { FoundComponent } from "./findComponent.ts";
import type { NearestTokens } from "./nearestToken.ts";
import type { TokenClash } from "./tokenClashes.ts";

/** The version of the documents' shape. */
export type AgentSchema = 1;

/** Where a story opens, in the view the answer describes. */
export type StoryLinks = {
  /** Its page in the catalogue (the shell, the story selected). */
  readonly address: string;
  /** Its component's page, where an audience in the view (`audience=designer`) reorders and filters what is drawn. */
  readonly component: string;
  /** Its frame alone: the story's own document, as the tests open it. */
  readonly frame: string;
  /** The story with no chrome, in the catalogue's theme: what a person pastes in a wiki or an iframe. */
  readonly embed: string;
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
  /**
   * The story's page in the catalogue, on the Design tab `@forgebook/plugin-figma` adds; on its first tab where the
   * catalogue lists no such plugin or turned the tab off.
   */
  readonly address: string;
};

/** A story, as the list of stories gives it. */
export type AgentStory = {
  /**
   * `<source>:<component>--<story>`, the rest as Storybook's id: what `forgebook story` takes, which also takes the id
   * an earlier rule gave it.
   */
  readonly id: string;
  /** The name the catalogue shows. */
  readonly name: string;
  /** The story file it is written in, relative to the module that declares the source. */
  readonly file: string;
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
  /** Whether a `play` function acts on it. */
  readonly hasPlay: boolean;
  /**
   * The device it is shown in by default (`parameters.device`, its own fields over the meta's), when either sets one;
   * the catalogue's `device` sits under it. Add the model's id to a view (`forgebook shot <id> --view iphone-16`) for
   * a framed picture.
   */
  readonly device?: StoryDeviceSetting;
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

/** A component (the story files with its title) and its stories. */
export type AgentComponent = {
  /** `<source>:<component>`, the part of its stories' ids before `--`. */
  readonly id: string;
  /** Its whole title (`Inputs/Selection/Select`). */
  readonly title: string;
  /** The id of the source it belongs to. */
  readonly source: string;
  /**
   * Its first story file, relative to the module that declares the source: the one its docs and its page come from.
   */
  readonly file: string;
  /** Every story file with its title, `file` first: one, unless the title is written in several files. */
  readonly files: readonly string[];
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
  /**
   * The names of the component's required props (`isRequired`), events among them, in the order of the source: what
   * every use must set. Its subcomponents' are not listed: their own `isRequired` says it. First in the answer, so a client that cuts a long one keeps it; `docs` keeps the source's
   * order, whatever the catalogue's `requiredFirst` says, since that setting shapes the pages only. Empty when there
   * are no docs.
   */
  readonly requiredProps: readonly string[];
  /** The story, with its links in the view asked for. */
  readonly story: AgentStory;
  /** Its component's id and title, and its "Used in" when the catalogue offers it. */
  readonly component: Pick<
    AgentComponent,
    "id" | "title" | "source" | "file" | "files" | "design" | "usedIn"
  >;
  /**
   * The component's docs as the props panel reads them (its props, their types, defaults and TSDoc); none when the
   * story file names no component, or its docs could not be read (the reason is then in `problems`).
   */
  readonly docs: ComponentDocs | undefined;
  /** Its design: its own `parameters.design.figma`, else its component's; none when it has none. */
  readonly design?: AgentDesign;
  /** The story's args once its module ran, the meta's under its own; only what can be written as JSON. */
  readonly args: Readonly<Record<string, unknown>>;
  /**
   * The props its values can set, as the panel sets them: each one's control and what its value looks like, its
   * `argTypes` taken into account. Give values through `args` of `forgebook story` or of the tools, or in the address's
   * `args=` as JSON.
   */
  readonly controls: readonly StoryControl[];
  /** What became of the values asked for (`args`), checked as a link's are; the links carry those it takes. */
  readonly setArgs?: Pick<SetArgs, "accepted" | "dropped">;
  /** What went wrong while reading it: its module failing to load, its docs failing to be read. */
  readonly problems: readonly string[];
  /**
   * `"off"` when the catalogue reads no component docs (`componentDocs: false`): `docs` is then none and
   * `requiredProps` empty whatever the component declares, and there is no "Used in". Absent when it reads them.
   */
  readonly componentDocs?: "off";
};

/** Where a docs page opens, in the view the answer describes. */
export type PageLinks = {
  /** Its page in the catalogue; a heading's anchor goes after it as the fragment. */
  readonly address: string;
};

/** A docs page, as the list of pages gives it. */
export type AgentPage = {
  /** `<source>:<title>` in kebab case, or `home` for the catalogue's written home: what `forgebook page` takes. */
  readonly id: string;
  /** Its whole title (`Guides/Theming`). */
  readonly title: string;
  /** The id of the source it belongs to; empty for the written home, which belongs to the catalogue. */
  readonly source: string;
  /** Its file, relative to the module that declares the source. */
  readonly file: string;
  /** What it is about, in a sentence; none when it does not say. */
  readonly description: string | undefined;
  /** The ids of the stories it shows, which `forgebook story` takes. */
  readonly stories: readonly string[];
  /** The ids of the components whose API tables it shows. */
  readonly components: readonly string[];
  /** Where it opens. */
  readonly links: PageLinks;
};

/** The docs pages a catalogue has, in reading order, and what is wrong in the index. */
export type PagesDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The catalogue's name. */
  readonly title: string;
  /** Every page. */
  readonly pages: readonly AgentPage[];
  /** The catalogue's written home (`forgebook.home.md`), which `forgebook page home` reads; none for the generated one. */
  readonly home?: AgentPage;
  /** One message per problem the index found: a page naming a story that is not there, a title taken twice. */
  readonly problems: readonly string[];
};

/** One docs page, to read. */
export type PageDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The page. */
  readonly page: AgentPage;
  /** Its headings, each anchor the fragment of its address. */
  readonly headings: readonly DocHeading[];
  /** Its Markdown, without its front matter; empty when it could not be read (the reason is then in `problems`). */
  readonly text: string;
  /** What went wrong while reading it. */
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
  /** Whether the catalogue or one of its sources names a tokens file at all. */
  readonly isConfigured: boolean;
  /** How many tokens match, whatever the limit. */
  readonly total: number;
  /** How many of each type. */
  readonly types: Readonly<Record<string, number>>;
  /** The tokens, up to the limit asked for, in the files' order. */
  readonly tokens: readonly AgentTokenSummary[];
  /** What in the tokens files could not be read. */
  readonly problems: readonly string[];
  /** The tokens listed here that two authors give different values, with whose stands. */
  readonly clashes: readonly TokenClash[];
};

/** One token, with all that is known of it. */
export type TokenDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The token. */
  readonly token: DesignToken;
  /** What in the tokens files could not be read. */
  readonly problems: readonly string[];
  /** Whose value stands, when two authors give this token different ones. */
  readonly clashes: readonly TokenClash[];
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

/** A line of a search's result: something inside a page that matched. */
export type AgentSearchHit = {
  /** What it is: a prop, an event, a story, a heading, text, a description. */
  readonly kind: SearchHitKind;
  /** Its name: the prop, the story, the heading; none for plain text. */
  readonly name?: string;
  /** The words around the match. */
  readonly text: string;
  /** The address that opens the page at it. */
  readonly address: string;
};

/** A search's result: a component or a docs page. */
export type AgentSearchResult = {
  /** What it is. */
  readonly kind: SearchResult["kind"];
  /** Its id: a docs page's goes to `page`. */
  readonly id: string;
  /** Its name. */
  readonly name: string;
  /** Where it sits. */
  readonly place: string;
  /** How well it matches: higher is better, only comparable within an answer. */
  readonly score: number;
  /** The words of the query it holds. */
  readonly matched: readonly string[];
  /** The words of the query it does not. */
  readonly missed: readonly string[];
  /** Why its name is there; empty when only what is inside it matched. */
  readonly reasons: readonly SearchReason[];
  /** The best of what matched inside it. */
  readonly hits: readonly AgentSearchHit[];
  /** How many things inside it matched, those not listed included. */
  readonly hitCount: number;
  /** The address that opens it. */
  readonly address: string;
};

/** What a search finds across a catalogue. */
export type SearchDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** The query. */
  readonly query: string;
  /** How many results there are, those past `limit` included. */
  readonly total: number;
  /** The results, best first; none means nothing in the catalogue holds those words. */
  readonly results: readonly AgentSearchResult[];
  /** What could not be read for the search: the rest still answers. */
  readonly problems: readonly string[];
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

/** A plugin as the documents give it. */
export type AgentPlugin = {
  /** Its id. */
  readonly id: string;
  /** The panel tabs it adds. */
  readonly tabs: readonly {
    /** The tab's id: `tab=<id>` in a view opens it. */
    readonly id: string;
    /** Its name. */
    readonly label: string;
    /** The story it is offered for; none for every story. */
    readonly when?: PluginCondition;
  }[];
  /** The ids of the switches it adds: `<id>=<value>` in a view sets one. */
  readonly switches: readonly string[];
  /** The fences of the docs blocks it adds. */
  readonly docBlocks: readonly string[];
  /** Whether it runs code around every story. */
  readonly runsInFrames: boolean;
};

/** What `forgebook plugins` and `list_plugins` answer. */
export type PluginsDocument = {
  /** The version of this document. */
  readonly schema: 1;
  /** The versions of the plugin API this Forgebook speaks. */
  readonly apiVersions: readonly number[];
  /** The plugins the configuration lists, in order. */
  readonly plugins: readonly AgentPlugin[];
};
