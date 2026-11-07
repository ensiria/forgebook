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
import type { StoryCheckResult } from "../storyCheck.ts";
import type { SetArgs, StoryControl } from "../storyControls.ts";
import type { SwitchControlKind, SwitchPreview, SwitchRole } from "../switches.ts";
import type { CodeProblem, CodeRule, ExcusedValue } from "./checkCode.ts";
import type { DesignToken, TokenSource } from "./designTokens.ts";
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
  "name" | "type" | "value" | "modes" | "deprecated" | "isThemeOnly" | "utility"
>;

/** The catalogue's tokens: how many, and the first of them, since agents degrade on long answers. */
export type TokensDocument = {
  /** The shape's version. */
  readonly schema: AgentSchema;
  /** Whether there is a system to ask about: a tokens file named by the catalogue or a source, or tokens read from the application. */
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
  /** What the tokens were read from, each file with how many it gives; none from an older catalogue. */
  readonly sources?: readonly TokenSource[];
  /** What the application's files hold that could not be read without running them, so some tokens may be unknown. */
  readonly notes?: readonly string[];
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

/** How a changed UI file is covered: by stories of its own, only through another component's, or by none. */
export type UiFileCoverage = "own" | "through" | "none";

/**
 * A story file `forgebook new` wrote for props its component no longer has: its args may pass a prop that is gone or miss
 * one that is now required, which neither the frame nor a check would say.
 */
export type OutdatedStoryFile = {
  /** The story file, relative to the repository. */
  readonly file: string;
  /** The same file, relative to the catalogue's folder: what a command run there names. */
  readonly path: string;
  /** One of its stories' ids, whose `story` answer lists the component's props. */
  readonly story: string;
  /** Its component's name. */
  readonly component: string;
  /** The props' signature the file says it was written for. */
  readonly written: string;
  /** The props' signature now. */
  readonly current: string;
  /** What to do. */
  readonly fix: string;
};

/** A changed file a person sees (`changeCoverage.ts`), and the stories that show it. */
export type ChangedUiFile = {
  /** The file, relative to the repository. */
  readonly file: string;
  /** The same file, relative to the catalogue's folder: what a command run there names. */
  readonly path: string;
  /** How it is covered. */
  readonly coverage: UiFileCoverage;
  /** The ids of the stories that reach it. */
  readonly stories: readonly string[];
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
  /** The changed files a person sees and that this catalogue can show, each with its stories. */
  readonly uiFiles: readonly ChangedUiFile[];
  /** The changed files a person sees that no story reaches and another catalogue of the repository answers for. */
  readonly outside: readonly string[];
  /** What could not be read: a group whose usage failed, a story file (`unread`). */
  readonly problems: readonly string[];
  /** The story files that cannot be read, whose stories no change can reach: a check of a change fails on them. */
  readonly unread?: readonly string[];
  /** The story files the change reaches that were written for other props; absent when there are none. */
  readonly outdated?: readonly OutdatedStoryFile[];
};

/** How `verify` ended. */
export type VerifyVerdict =
  /** Every changed UI file ran in stories, every check ran, and nothing was found. */
  | "verified"
  /** Nothing was found, but `skipped` names what was not checked. */
  | "partly-verified"
  /**
   * A changed UI file has no story that ran, a story that reaches the change was never seen in its final state (its frame
   * gave up on what it loads: `notVerified`), the catalogue has a problem that stops it telling, or nothing changed since
   * a start nobody named: the work may be committed where this cannot see it.
   */
  | "not-verified"
  /** A check found a problem. */
  | "failed"
  /** No UI file changed; `skipped` names what was not checked. */
  | "nothing-to-verify";

/** A changed UI file, as `verify` ends up with it. */
export type VerifiedUiFile = {
  /** The file, relative to the repository. */
  readonly file: string;
  /** How it is covered by stories that ran; `none` when none of those that reach it ran. */
  readonly coverage: UiFileCoverage;
  /** How many stories that ran reach it. */
  readonly stories: number;
  /** Why it is not verified. */
  readonly reason?: string;
  /** What to do about it: the command to run, when there is one. */
  readonly fix?: string;
};

/** A story and view that found something. */
export type VerifyFailure = {
  /** The story's id. */
  readonly storyId: string;
  /** The view, in the address's form; empty for the default. */
  readonly view: string;
  /** What it found. */
  readonly problems: StoryCheckResult["problems"];
  /** The links that open the story; those of a server started for the run would be dead by now. */
  readonly links?: StoryLinks;
};

/** The one answer to whether a change is verified. */
export type VerifyDocument = {
  /** The shape's version: this shape is not the first `verify` answered. */
  readonly schema: 2;
  /** How it ended; `not-verified` and `failed` exit non-zero. */
  readonly verdict: VerifyVerdict;
  /** The verdict in one line, what was not checked included. */
  readonly summary: string;
  /** What was not checked: never read an empty list of problems as all clear when these are named. */
  readonly skipped: readonly string[];
  /** What the change is measured from, as named. */
  readonly since: string;
  /** The commit that is: where the branch left `since`. */
  readonly base: string;
  /** The views the stories ran in: every variant the browser tests check, or `quick`'s default view. */
  readonly variants: "all" | "default";
  /** The files changed, relative to the repository. */
  readonly files: readonly string[];
  /** The changed UI files. */
  readonly uiFiles: readonly VerifiedUiFile[];
  /** How many stories reach the change. */
  readonly storyCount: number;
  /** The first of them, with the links that open them: a shared sheet reaches every story, and an answer stays short. */
  readonly stories: readonly AgentChangedStory[];
  /** How many story and view pairs ran. */
  readonly ran: number;
  /** The pairs that found something, with the links that open the story; those that pass are only counted. */
  readonly failures: readonly VerifyFailure[];
  /** The pairs no check saw in their final state: their frame gave up on what the story loads. None of them passed. */
  readonly notVerified: readonly VerifyNotVerified[];
  /** What the change adds, by `check-code`. */
  readonly code: {
    /** What was checked. */
    readonly checked: readonly CodeRule[];
    /** What breaks the design system in a changed UI file: these fail. */
    readonly problems: readonly CodeProblem[];
    /** What it found in a file no one sees: a turned-off check, a deleted test. Said, and not a failure. */
    readonly notes: readonly CodeProblem[];
    /** What the values were compared with, each file with how many tokens it gives. */
    readonly tokenSources?: readonly TokenSource[];
    /** What the application's files hold that could not be read without running them. */
    readonly tokenNotes?: readonly string[];
    /** The values a comment in the change says are meant. */
    readonly excused?: readonly ExcusedValue[];
  };
  /** The story files the change reaches that were written for other props, each with its fix; absent when none. */
  readonly outdated?: readonly OutdatedStoryFile[];
  /** How many problems there are, in `failures`, `code.problems` and `outdated` together. */
  readonly problems: number;
};

/** A story and view whose checks did not run, since its frame gave up on what the story loads. */
export type VerifyNotVerified = {
  /** The story's id. */
  readonly storyId: string;
  /** The view, or the variant's name. */
  readonly view: string;
  /** Why, as the frame says it. */
  readonly notVerified: string;
  /** The links that open the story. */
  readonly links?: AgentChangedStory["links"];
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
  /** What the values were compared with, each file with how many tokens it gives; none from an older catalogue. */
  readonly tokenSources?: readonly TokenSource[];
  /** How many tokens two files give different values: `forgebook tokens` names them. */
  readonly tokenClashes?: number;
  /** What the application's files hold that could not be read without running them, so some tokens may be unknown. */
  readonly tokenNotes?: readonly string[];
  /** The changed files whose values were not compared, being outside the folder whose system was read. */
  readonly notCompared?: readonly string[];
  /** The values a comment in the change says are meant, each with the comment's reason. */
  readonly excused?: readonly ExcusedValue[];
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

/** A switch's value as the documents give it. */
export type AgentSwitchValue = {
  /** The value, as the address writes it. */
  readonly value: string;
  /** Its name. */
  readonly label: string;
  /** What to write in a view to draw it (`look=night`). */
  readonly view: string;
  /** The values it sets on other switches while drawn, by switch id. */
  readonly implies?: Readonly<Record<string, string>>;
  /** Its own style sheet, by its path from the configuration's folder. */
  readonly sheet?: string;
  /** What a gallery shows of it: a picture by its path from the configuration's folder, or colours and a font's name. */
  readonly preview?: SwitchPreview;
};

/** What `forgebook switches` and `list_switches` answer. */
export type SwitchesDocument = {
  /** The shape's version. */
  readonly schema: 1;
  /** The catalogue's switches, the ready-made ones among them, in their order. */
  readonly switches: readonly {
    /** Its id, the address's parameter. */
    readonly id: string;
    /** Its name. */
    readonly label: string;
    /** The value when a view names none. */
    readonly default: string;
    /** How the shell offers it. */
    readonly control: SwitchControlKind;
    /** What the catalogue reads of it; none for a switch only the library reads. */
    readonly role?: SwitchRole;
    /** Its values, in their order. */
    readonly values: readonly AgentSwitchValue[];
  }[];
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

/** The list of the agents' guide, as `forgebook guide --json` and `get_guide` answer with no topic. */
export type GuideListDocument = {
  /** The document's version. */
  readonly schema: AgentSchema;
  /** Each topic: its name, as `forgebook guide <name>` takes it, and what it is about. */
  readonly topics: ReadonlyArray<{ readonly topic: string; readonly about: string }>;
  /** The frameworks found in this project, whose topics are the ones to read. */
  readonly frameworks: readonly string[];
};

/** One topic of the agents' guide, as `forgebook guide <topic> --json` and `get_guide` answer. */
export type GuideDocument = {
  /** The document's version. */
  readonly schema: AgentSchema;
  /** The topic's name. */
  readonly topic: string;
  /** Its Markdown. */
  readonly text: string;
};
