/**
 * What a package hands a catalogue: its story files, its style sheets, its texts, its docs pages.
 *
 * @remarks
 * Every package with stories exports one `StorySource` from a development-only `./stories` subpath, never published;
 * an app lists the sources it shows. A source names its story files once per pattern, with an import the
 * catalogue's Vite plugin answers (`import files from "../src/**\/*.stories.tsx?forgebook-files"`, typed by
 * `@forgebook/story-format/client`): one module with every file's index (read without running the files), and the loaders
 * of its stories, its component's docs and its code. The style sheets are the URLs the frame loads for each
 * Styles setting. Its design tokens are paths, not imports: tools read them without loading the source, and the pages
 * carry nothing of them.
 *
 * @module
 */
import type { StoryGroup } from "./csf.ts";
import type { StoryTextTable } from "./texts.ts";

/** What a Figma file is, as the embed's address names it. */
export type FigmaFileKind = "design" | "proto" | "board" | "slides" | "deck";

/**
 * A design's link (`parameters.design.figma`), as the index checked it: only a link to a file on Figma's own hosts gets
 * here, taken apart, so the pages and the tools trust it without checking it again.
 */
export type FigmaLink = {
  /** The link to open in Figma, rebuilt from the parts below on `www.figma.com`. */
  readonly url: string;
  /** What the file is. */
  readonly kind: FigmaFileKind;
  /** The file's key. */
  readonly fileKey: string;
  /** The branch's key, for a link to a branch of the file. */
  readonly branchKey?: string;
  /** The node it points at, as Figma's REST API writes it (`12:34`); none for a link to the whole file. */
  readonly nodeId?: string;
};

/** The props the panel can set for a story: every adjustable one, or only the named ones (none for fixed examples). */
export type StoryControlsSetting = "all" | readonly string[];

/** One story of a file, as the index lists it. */
export type StoryIndexEntry = {
  /** The named export (`KeyboardOpen`). */
  readonly exportName: string;
  /**
   * The story's id as it writes it (Storybook's `parameters.__id`, a plain string), when it writes one: it replaces the
   * id made from the meta and the export, without the source's id.
   */
  readonly id?: string;
  /** The name written in the story, when it has one (`name: "Keyboard · open"`). */
  readonly name?: string;
  /** The story's own `parameters.controls`, when it sets one: `[]` for `false`. */
  readonly controls?: StoryControlsSetting;
  /** The story's `parameters.group`, when it sets one. */
  readonly group?: StoryGroup;
  /** The story's own `parameters.height`, when it sets one, in CSS px. */
  readonly height?: number;
  /**
   * The story's own `parameters.design.figma`, when it sets one: `null` when that link is not a Figma file's (noted in
   * the file's `notes`), so the story shows no design rather than the meta's.
   */
  readonly design?: FigmaLink | null;
  /** Whether the story sets `parameters.main: true`: the component's demo. */
  readonly isMain?: boolean;
  /**
   * The story's own `parameters.touch`, when it sets one: `true` for a story meant for a phone, which starts in the
   * catalogue's simulated touch and offers a toggle to turn it off; `false` to leave the meta's out.
   */
  readonly isTouch?: boolean;
  /**
   * The story's own `parameters.logic`, when it sets one: `true` for a story about logic, not looks (a hook's scene),
   * `false` to leave the meta's out.
   */
  readonly isLogic?: boolean;
  /**
   * The first sentence of the story's TSDoc, or its `parameters.docs.description.story`: what it shows and what to
   * notice.
   */
  readonly description?: string;
  /** The story's tags, the meta's then its own, a `!name` taking `name` away (Storybook's tags). */
  readonly tags?: readonly string[];
  /**
   * Whether the file writes a `play` for the story: its own, one from a story of the file it spreads, or the meta's.
   * Left out when it writes none, as far as reading the file without running it can tell.
   */
  readonly hasPlay?: boolean;
};

/** One story file, read statically: what the catalogue shows before loading it. */
export type StoryFileIndex = {
  /** The meta's title (`Inputs/Selection/Select`). */
  readonly title: string;
  /**
   * The meta's `id`, when it writes one: its stories' ids start with it instead of the title, as Storybook's do
   * (`id: "menus"` gives `menus--overview`).
   */
  readonly id?: string;
  /** The meta's `parameters.controls`, when it sets one: `[]` for `false`. */
  readonly controls?: StoryControlsSetting;
  /** The meta's `parameters.height`, when it sets one: every story's frame height, in CSS px. */
  readonly height?: number;
  /**
   * The meta's `parameters.design.figma`, when it sets a valid one (a wrong one is in `notes`): the component's, and
   * every story's.
   */
  readonly design?: FigmaLink;
  /** The meta's `parameters.touch`, when it sets one: every story starts in touch unless it says otherwise. */
  readonly isTouch?: boolean;
  /** The meta's `parameters.logic`, when it sets one: every story is about logic unless it says otherwise. */
  readonly isLogic?: boolean;
  /** The meta's `alsoIn`, when it sets one: the other places the component is listed in. */
  readonly alsoIn?: readonly string[];
  /** The meta's `related`, when it sets one: the titles of the components its page names at its top. */
  readonly related?: readonly string[];
  /** The meta's `keywords`, when it sets one: other words the search finds the component by. */
  readonly keywords?: readonly string[];
  /** The meta's `parameters.propGroups`, when it sets one: the component's prop groups listed first, in order. */
  readonly propGroups?: readonly string[];
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

/** A language's texts in a source: the table, keyed by text key, or a loader of the module whose default it is. */
export type StoryTexts = StoryTextTable | (() => Promise<{ readonly default: StoryTextTable }>);

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
  /**
   * `rtl` for a language read right to left (Arabic, Hebrew): picked, it draws the stories right to left, as a page in
   * that language is; left to right by default.
   */
  readonly dir?: "rtl";
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
  /**
   * The group's "Used in": for each of its components, the other components whose stories use it (`{ error }` when it
   * cannot be read). None when the catalogue turned it off, or for files indexed before it existed.
   */
  readonly usage?: () => Promise<unknown>;
  /** Each of the group's stories with the files it reaches, for tools on the dev server; none in a static build. */
  readonly reach?: () => Promise<unknown>;
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

/** A docs page as the index lists it, read from its file before anyone opens it. */
export type DocPageIndex = {
  /** Its place and name: `Guides/Theming`, or `Theming` for a page outside any group. */
  readonly title: string;
  /** Where it sits among the pages: lower first, then the pages without one, by title. */
  readonly order?: number;
  /** What it is about, in a sentence: the page's lead, and what tools list. */
  readonly description?: string;
  /** The ids of the stories it shows, in its order. */
  readonly stories: readonly string[];
  /** The ids of the components whose API tables it shows, in its order. */
  readonly components: readonly string[];
  /** The slugs of the pages it links to, which the catalogue checks across every group of the source. */
  readonly links: readonly string[];
  /** What the index noticed without refusing the file: an unknown key, a missing image. */
  readonly notes?: readonly string[];
};

/**
 * The docs pages of a pattern, as the catalogue's plugin answers a `?forgebook-docs-pages` import: each page's index and
 * the loader of the page, by the file's path relative to the importing module (`./docs/theming.md`).
 */
export type DocPages = {
  /** Each page's index: its title and what it shows, read from its file. */
  readonly index: Readonly<Record<string, DocPageIndex>>;
  /** Each page, loaded when it opens. */
  readonly pages: Readonly<Record<string, () => Promise<unknown>>>;
  /** Each page's Markdown, for tools on the dev server; none in a static build. */
  readonly text?: Readonly<Record<string, () => Promise<unknown>>>;
};

/**
 * A design tokens file of a package: its path from the module that declares the source, with its theme when it is a
 * theme's (the format has no themes of its own, so a theme is a file over the base).
 */
export type StoryTokensFile = string | { readonly file: string; readonly mode: string };

/** A package's stories, as the catalogue reads them. */
export type StorySource = {
  /** A stable id, part of every story id's URL (`acme-ui`). */
  readonly id: string;
  /** The name in the sidebar (`Acme UI`). */
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
   * default. Each language is its table, or a loader of it (`en: () => import("./locales/en.json")`): a loader keeps
   * the texts out of the catalogue's page, which never shows them, and a frame loads only the languages it draws in.
   */
  readonly texts?: Readonly<Record<string, StoryTexts>>;
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
  /**
   * Its docs pages: guides and foundations in Markdown, with live stories, listed in the sidebar's Docs section. One
   * group per `?forgebook-docs-pages` import, the keys unique across the groups. None by default.
   */
  readonly docs?: readonly DocPages[];
  /**
   * The package's design tokens, DTCG 2025.10 files, the base first
   * (`["tokens.json", { file: "dark.tokens.json", mode: "dark" }]`): every catalogue that shows the source adds them to
   * its own, and `forgebook docs` lists them in `CATALOG.md`. They are read from the module's text, never by running it,
   * so a broken story cannot hide them: write the list here, in the object of `export const source`, with plain strings
   * (a source re-exported or spread from another module gives none) and paths inside the package. None by default.
   */
  readonly tokens?: readonly StoryTokensFile[];
};
