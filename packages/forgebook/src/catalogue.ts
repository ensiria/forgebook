/**
 * The lists a catalogue sets besides its switches (its widths, zoom steps, text sizes, backgrounds, story groups,
 * panel tabs, accessibility rules, grid step, storage name and shell texts), as its configuration writes them, and
 * as the shell and the frame read them, today's defaults filled in.
 *
 * @remarks
 * Every list is optional: a catalogue that sets none looks as Forgebook always did. 100 % stays a zoom step and a text
 * size, since it is the view without change. A preset may give any list; the catalogue's own wins (`configFile.ts`).
 * Pure.
 *
 * @module
 */

import { type Backdrop, BUILT_IN_BACKDROPS, type CustomBackdrop, customBackdrop } from "./backdrops.ts";
import type { ViewSwitch } from "./switches.ts";

/** A preset width of the toolbar. */
export type StageWidthPreset = {
  /** The width, in CSS px. */
  readonly width: number;
  /** Its name in the toolbar; the number by default. */
  readonly label?: string;
};

/** A group of stories in the sidebar, as a catalogue names it. */
export type StoryGroupSetting = {
  /** The group's id, as a story's `parameters.group` writes it (`states`). */
  readonly id: string;
  /** Its heading in the sidebar (`States`). */
  readonly label: string;
};

/** The tabs of the panel under a story. */
export const PANEL_TAB_IDS = ["props", "events", "play", "parts", "code", "a11y"] as const;

/** A tab of the panel under a story. */
export type PanelTabId = (typeof PANEL_TAB_IDS)[number];

/** The accessibility rules the Accessibility tab and the generated tests check. */
export type A11ySettings = {
  /** The axe tags whose rules apply. */
  readonly tags: readonly string[];
  /** Rules turned off by id (`color-contrast`). */
  readonly disabledRules: readonly string[];
};

/** The lists a configuration may set, every one optional. */
export type CatalogueLists = {
  /** The catalogue's id, the prefix of what the browser stores for it; from its title by default. */
  readonly id?: string;
  /** The toolbar's preset widths. */
  readonly widths?: readonly StageWidthPreset[];
  /** The narrowest and widest a story may be set, in CSS px. */
  readonly widthRange?: { readonly min: number; readonly max: number };
  /** The zoom steps, in percent; 100 among them. */
  readonly zooms?: readonly number[];
  /** The text sizes, in percent of the browser's; 100 among them. */
  readonly textSizes?: readonly number[];
  /** The backgrounds: which built-in ones (`false` for none) and the catalogue's own. */
  readonly backgrounds?: {
    /** The built-in backgrounds offered, by id, or none; all of them by default. */
    readonly builtIn?: false | readonly string[];
    /** The catalogue's own, after the built-in ones. */
    readonly custom?: readonly CustomBackdrop[];
  };
  /** The story groups, in the sidebar's order, with their headings. */
  readonly storyGroups?: readonly StoryGroupSetting[];
  /** The panel's tabs turned off (`{ a11y: false }`). */
  readonly tabs?: Readonly<Partial<Record<PanelTabId, false>>>;
  /** The accessibility rules. */
  readonly a11y?: Partial<A11ySettings>;
  /** The measuring grid's step, in CSS px. */
  readonly gridStep?: number;
  /** Texts of the shell replaced, by their name in `STRINGS` (a translation, another word). */
  readonly strings?: Readonly<Record<string, string>>;
};

/** A catalogue's lists with the defaults filled in, and its switches: what the shell and the frame read. */
export type CatalogueSettings = {
  /** The prefix of what the browser stores for the catalogue. */
  readonly id: string;
  /** The switches of the toolbar and the View menu. */
  readonly switches: readonly ViewSwitch[];
  /** The toolbar's preset widths. */
  readonly widths: readonly StageWidthPreset[];
  /** The narrowest and widest a story may be set, in CSS px. */
  readonly widthRange: { readonly min: number; readonly max: number };
  /** The zoom steps, in percent. */
  readonly zooms: readonly number[];
  /** The text sizes, in percent. */
  readonly textSizes: readonly number[];
  /** The backgrounds the View menu offers besides the page's own colour. */
  readonly backdrops: readonly Backdrop[];
  /** The named story groups, in their order. */
  readonly storyGroups: readonly StoryGroupSetting[];
  /** The panel's tabs shown, in their order. */
  readonly tabs: readonly PanelTabId[];
  /** The accessibility rules. */
  readonly a11y: A11ySettings;
  /** The measuring grid's step, in CSS px. */
  readonly gridStep: number;
  /** The shell's texts replaced, by name. */
  readonly strings: Readonly<Record<string, string>>;
};

/** WCAG 2.2 at levels A and AA: the rules every story passes by default. */
export const DEFAULT_A11Y_TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** The toolbar's widths by default: a phone, the stage beside the props panel (the tests' narrow variant), a tablet, a laptop. */
const DEFAULT_WIDTHS: readonly StageWidthPreset[] = [
  { width: 360 },
  { width: 560 },
  { width: 768 },
  { width: 1024 }
];

/**
 * An id for the browser's storage from a catalogue's title: lower case, words joined by hyphens.
 *
 * @param title - the title.
 */
const idOf = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "catalogue";

/**
 * A list of percents with 100 in it, in order: the configured one when it has 100, the default otherwise.
 *
 * @param list - the configured list.
 * @param fallback - the default.
 */
const withHundred = (list: readonly number[] | undefined, fallback: readonly number[]): readonly number[] =>
  list?.includes(100) ? [...list].sort((first, second) => first - second) : fallback;

/**
 * A catalogue's settings, its lists' defaults filled in.
 *
 * @param title - the catalogue's title, for its storage's id.
 * @param switches - its switches.
 * @param lists - the lists its configuration sets.
 */
export const catalogueSettings = (
  title: string,
  switches: readonly ViewSwitch[],
  lists: CatalogueLists = {}
): CatalogueSettings => {
  const builtIn = lists.backgrounds?.builtIn;
  const offered =
    builtIn === false
      ? []
      : BUILT_IN_BACKDROPS.filter((backdrop) => builtIn === undefined || builtIn.includes(backdrop.id));
  const tabsOff = lists.tabs ?? {};
  return {
    id: lists.id ?? idOf(title),
    switches,
    widths: lists.widths ?? DEFAULT_WIDTHS,
    widthRange: lists.widthRange ?? { min: 240, max: 2560 },
    zooms: withHundred(lists.zooms, [50, 75, 100, 125, 150, 200]),
    textSizes: withHundred(lists.textSizes, [100, 125, 150]),
    backdrops: [...offered, ...(lists.backgrounds?.custom ?? []).map(customBackdrop)],
    storyGroups: lists.storyGroups ?? [],
    tabs: PANEL_TAB_IDS.filter((tab) => tabsOff[tab] !== false),
    a11y: {
      tags: lists.a11y?.tags ?? DEFAULT_A11Y_TAGS,
      disabledRules: lists.a11y?.disabledRules ?? []
    },
    gridStep: lists.gridStep ?? 8,
    strings: lists.strings ?? {}
  };
};

/**
 * A story group's heading: the catalogue's name for it, or its id when it names none.
 *
 * @param groups - the catalogue's named groups.
 * @param id - the group's id.
 */
export const groupLabel = (groups: readonly StoryGroupSetting[], id: string): string =>
  groups.find((group) => group.id === id)?.label ?? id;
