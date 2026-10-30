/**
 * What a package hands a catalogue: its story files, its style sheets, its texts.
 *
 * @remarks
 * Every package with stories exports one `StorySource` from a development-only `./stories` subpath, never published;
 * an app lists the sources it shows (D-57). A source names its story files once per pattern, with an import the
 * catalogue's Vite plugin answers (`import files from "../src/**\/*.stories.tsx?forgebook-files"`, typed by
 * `@forgebook/story-format/client`): one module with every file's index (read without running the files), and the loaders
 * of its stories, its component's docs and its code (D-438). The style sheets are the URLs the frame loads for each
 * Styles setting.
 *
 * @module
 */
import type { StoryGroup } from "./csf";

/** The props the panel can set for a story: every adjustable one, or only the named ones (none for fixed examples). */
export type StoryControlsSetting = "all" | readonly string[];

/** One story of a file, as the index lists it. */
export type StoryIndexEntry = {
  /** The named export (`KeyboardOpen`). */
  readonly exportName: string;
  /** The name written in the story, when it has one (`name: "Keyboard · open"`). */
  readonly name?: string;
  /** The story's own `parameters.controls`, when it sets one: `[]` for `false`. */
  readonly controls?: StoryControlsSetting;
  /** The story's `parameters.group`, when it sets one. */
  readonly group?: StoryGroup;
  /** The story's own `parameters.height`, when it sets one, in CSS px (D-469). */
  readonly height?: number;
  /** Whether the story sets `parameters.main: true`: the component's demo. */
  readonly isMain?: boolean;
  /**
   * The first sentence of the story's TSDoc, or its `parameters.docs.description.story`: what it shows and what to
   * notice.
   */
  readonly description?: string;
  /** The story's tags, the meta's then its own, a `!name` taking `name` away (Storybook's tags). */
  readonly tags?: readonly string[];
};

/** One story file, read statically: what the catalogue shows before loading it. */
export type StoryFileIndex = {
  /** The meta's title (`Inputs/Selection/Select`). */
  readonly title: string;
  /** The meta's `parameters.controls`, when it sets one: `[]` for `false`. */
  readonly controls?: StoryControlsSetting;
  /** The meta's `parameters.height`, when it sets one: every story's frame height, in CSS px (D-469). */
  readonly height?: number;
  /** The meta's `alsoIn`, when it sets one: the other places the component is listed in (D-492). */
  readonly alsoIn?: readonly string[];
  /** The meta's `related`, when it sets one: the titles of the components its page names at its top (D-492). */
  readonly related?: readonly string[];
  /** The meta's `keywords`, when it sets one: other words the search finds the component by (D-603). */
  readonly keywords?: readonly string[];
  /** The meta's `parameters.docs.description.component`, when written plainly. */
  readonly description?: string;
  /** What the index noticed without refusing the file (a title written by code, placed by its path). */
  readonly notes?: readonly string[];
  /** Its stories, in the order of the file (or of its `__namedExportsOrder`). */
  readonly stories: readonly StoryIndexEntry[];
};

/** The style sheets of a package, as URLs, for each Styles setting of the toolbar. */
export type StorySheets = {
  /** Always loaded: the tokens and the structure. */
  readonly required: readonly string[];
  /** Loaded with Styles › Full: the theme. */
  readonly theme: readonly string[];
  /** Loaded with Styles › Restyled, instead of the theme: a consumer's own look through the public hooks. */
  readonly restyled: readonly string[];
};

/**
 * A language a catalogue offers (the View menu's Language row): its id and name, and whether its texts are a
 * pseudo-translation. Data only: the provider that draws a story in a language is a decorator of the catalogue's
 * preview, which reads the language as `context.globals.lang`.
 */
export type StoryLanguage = {
  /** A stable id, written in the address (`pseudo`). */
  readonly id: string;
  /** The name in the View menu (`Pseudo`). */
  readonly label: string;
  /**
   * Whether the stories' own texts are drawn as a pseudo-translation of the English ones (accented, longer, in
   * brackets) instead of a table of their own; `false` by default.
   */
  readonly isPseudo?: boolean;
};

/** A story's `render` as written in its file. */
export type StoryCode = {
  /** The text, as copied. */
  readonly text: string;
  /** The same text as HTML, coloured by the catalogue's plugin at build time. */
  readonly html: string;
};

/** Each story's `render` as written in its file, by export name; a story without one is left out. */
export type StoryFileCode = Readonly<Record<string, StoryCode>>;

/**
 * A group of story files, as the catalogue's plugin answers a `?forgebook-files` import: each file's index, and the
 * loaders of its module, of its component's docs and of its code, all by the file's path relative to the importing
 * module (`../src/inputs/select/Select.stories.tsx`).
 */
export type StoryFiles = {
  /** Each file's index: its title and stories, read without running it. */
  readonly index: Readonly<Record<string, StoryFileIndex>>;
  /** Each file's module, loaded when a frame shows one of its stories. */
  readonly stories: Readonly<Record<string, () => Promise<unknown>>>;
  /** Each file's component docs, for the props panel (`{ error }` when they cannot be read, `{ name: null }` for none). */
  readonly docs: Readonly<Record<string, () => Promise<unknown>>>;
  /** Each file's code: each story's `render` as written, for the Code tab. */
  readonly code: Readonly<Record<string, () => Promise<unknown>>>;
  /** Each file's component page: its Markdown documentation, beside the story file, as HTML (`{ none: true }` without). */
  readonly pages: Readonly<Record<string, () => Promise<unknown>>>;
};

/**
 * The colour of the page a source's stories open on, by theme and contrast: the catalogue paints a story's box with it
 * while the story loads, so the box is not white before a dark story and does not change colour when the story shows.
 * A CSS colour each; the more-contrast ones fall back to their scheme's.
 */
export type StoryBackground = {
  /** The light theme's. */
  readonly light: string;
  /** The dark theme's. */
  readonly dark: string;
  /** The light theme's with more contrast; `light` when left out. */
  readonly lightMore?: string;
  /** The dark theme's with more contrast; `dark` when left out. */
  readonly darkMore?: string;
};

/** A Markdown file as the catalogue's plugin answers a `?forgebook-markdown` import: its text as HTML. */
export type StoryMarkdown = {
  /** The file as HTML, its first `#` title left out (the catalogue shows the source's name). */
  readonly html: string;
};

/** A package's stories, as the catalogue reads them. */
export type StorySource = {
  /** A stable id, part of every story id's URL (`acme-ui`). */
  readonly id: string;
  /** The name in the sidebar (`Kaji UI`). */
  readonly name: string;
  /**
   * The package's logo, shown beside its name in the sidebar and on the home: the URL of a square image, drawn for a
   * light surface (`import logoUrl from "./logo.svg?url"`). None by default.
   */
  readonly logo?: string;
  /**
   * The colour the stories' page has (the frame's `body`, as the source's frame style sheet sets it), by theme and
   * contrast, for the box a story loads in. None by default: the box waits on the catalogue's own surface.
   */
  readonly background?: StoryBackground;
  /** The families in the order the sidebar lists them; families not listed follow, alphabetically. */
  readonly families?: readonly string[];
  /**
   * The groups of a family in the order the sidebar lists them, by family (`{ Inputs: ["Text", "Choice"] }`): a
   * family's own components without a group come first, then its groups as listed, then the groups not listed,
   * alphabetically. None by default: every family's groups alphabetically.
   */
  readonly familyGroups?: Readonly<Record<string, readonly string[]>>;
  /** Its story files: one group per `?forgebook-files` import, the keys unique across the groups. */
  readonly files: readonly StoryFiles[];
  /** The style sheets. */
  readonly sheets: StorySheets;
  /**
   * Values the props panel offers by name for a type it cannot write (a component, a function), keyed by the type as
   * TypeScript writes it in the props (`IconComponent`), then by the name shown and written in the JSX
   * (`IconFolder`): `{ IconComponent: { IconFolder, IconBell } }`. None by default.
   */
  readonly namedValues?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /**
   * The texts inside the stories, by language id (the ids of the catalogue's languages; `en` the one every key is in):
   * the package's `stories/locales/<id>.json`. A story reads them with `useStoryText()` or `context.text()`; none by
   * default.
   */
  readonly texts?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * What the source needs before any of its stories renders (a polyfill to load), awaited by the frame and by the
   * server tests; nothing by default.
   */
  readonly setup?: () => Promise<void>;
  /**
   * The source's introduction on the catalogue's home, written by the package: what it is, how to start
   * (`home: () => import("./home.md?forgebook-markdown")`). None by default: the home then shows only its families.
   */
  readonly home?: () => Promise<{ readonly default: StoryMarkdown }>;
};
