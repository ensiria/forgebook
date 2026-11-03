/**
 * The lists a catalogue sets besides its switches (its widths, zoom steps, text sizes, backgrounds, story groups,
 * panel tabs, accessibility rules, grid step, storage name, shell texts, Forgebook's own controls and what starts on
 * the toolbar), as its configuration writes them, and as the shell and the frame read them, today's defaults filled
 * in.
 *
 * @remarks
 * Every list is optional: a catalogue that sets none looks as Forgebook always did. 100 % stays a zoom step and a text
 * size, since it is the view without change. A preset may give any list; the catalogue's own wins (`configFile.ts`).
 * Pure.
 *
 * @module
 */

import { type AudienceId, DEFAULT_AUDIENCE } from "./audiences.ts";
import { type Backdrop, BUILT_IN_BACKDROPS, type CustomBackdrop, customBackdrop } from "./backdrops.ts";
import { type ControlKeys, catalogueKeys } from "./controlKeys.ts";
import type { CatalogueView } from "./namedViews.ts";
import { switchWithRole, type TouchChoice, touchChoiceOf, type ViewSwitch } from "./switches.ts";
import { viewQuery } from "./viewWords.ts";

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

/** Forgebook's own tabs of the panel under a story. */
export const PANEL_TAB_IDS = ["props", "events", "play", "parts", "code", "a11y", "signature"] as const;

/** One of Forgebook's own tabs of the panel under a story. */
export type PanelTabId = (typeof PANEL_TAB_IDS)[number];

/**
 * Forgebook's own controls of the toolbar and the View menu, beside the catalogue's switches: the background, the
 * style sheets, the text size, the stage's width and who a component's page is read by. Their ids are the address's
 * own parameters, so no switch takes one.
 */
export const OWN_CONTROL_IDS = ["backdrop", "sheets", "text", "width", "audience"] as const;

/** One of Forgebook's own controls. */
export type OwnControlId = (typeof OWN_CONTROL_IDS)[number];

/**
 * What `controls` turns off: one of Forgebook's own controls, its ready-made direction or touch switch, or the story
 * bar's Embed button.
 */
export type TurnedOffControl = OwnControlId | "direction" | "touch" | "embed";

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
  /** The panel's tabs turned off, Forgebook's or a plugin's (`{ a11y: false }`). */
  readonly tabs?: Readonly<Partial<Record<PanelTabId, false>> & Record<string, false>>;
  /** The accessibility rules. */
  readonly a11y?: Partial<A11ySettings>;
  /** The measuring grid's step, in CSS px. */
  readonly gridStep?: number;
  /** Texts of the shell replaced, by their name in `STRINGS` (a translation, another word). */
  readonly strings?: Readonly<Record<string, string>>;
  /**
   * Forgebook's own controls turned off (`{ sheets: false }`): shown nowhere, and the background, the style sheets
   * and the text size keep their default; the stage's width is still set by the stage's handle. `direction: false`
   * and `touch: false` drop the ready-made direction and touch switches. `embed: false` takes the Embed button off
   * the story bar; a `?embed` address still works, since any page can frame what it can open.
   */
  readonly controls?: Readonly<Partial<Record<TurnedOffControl, false>>>;
  /**
   * The controls that start on the toolbar, in their order, by id (a switch's id or one of `OWN_CONTROL_IDS`); the
   * colour scheme, the contrast and the width by default. A control turned off in `controls` (here or by a preset) is
   * left out. A person's own arrangement replaces it.
   */
  readonly toolbar?: readonly string[];
  /**
   * Whether a component's page offers "Used in", the other components whose stories use it; `true` by default.
   * `false` builds nothing for it (no import graph is read) and leaves it out of the agents' answers.
   */
  readonly usedIn?: boolean;
  /**
   * Who a component's page is read by before a person picks: `designer`, `coder` or `tester` reorder and filter the
   * page for them, and `everyone` (the default) draws all of it. The address's `audience` wins, so a link keeps its view;
   * with `controls: { audience: false }` the catalogue's choice is the only one.
   */
  readonly audience?: AudienceId;
  /**
   * The shell's appearance before a reader picks one; `story` follows the colour scheme of the story shown, for a
   * library that wants one page with its stories: `system` (the default) follows the system's light or dark. A
   * reader's choice, kept in their browser, wins over it; the frames follow the view's switches, never this.
   */
  readonly appearance?: Appearance;
  /**
   * The keys that cycle the controls, by control id (a switch's id or one of `OWN_CONTROL_IDS`): one character,
   * pressed without a modifier; `false` takes a key away. The ready-made switches have one by default (`DEFAULT_KEYS`
   * of `controlKeys.ts`). A reader may change them for themself.
   */
  readonly keys?: Readonly<Record<string, string | false>>;
  /**
   * Views offered to every reader at the top of the View menu, each a name and its values in the address's form
   * (`theme=dark&width=360`) or as words (`"dark it 360"`); a reader saves their own beside them.
   */
  readonly views?: readonly CatalogueView[];
  /**
   * The prop groups listed first in every component's API reference and Props tab, in this order, by the name their
   * props' TSDoc gives (`@group Selection`). A component's meta may name its own first (`parameters.propGroups`); the
   * groups named nowhere follow in the order they first appear. The props that name no group always come first.
   */
  readonly propGroups?: readonly string[];
};

/** The shell's own appearance: light, dark, the system's, or the colour scheme of the story shown. */
export type Appearance = "light" | "dark" | "system" | "story";

/** The appearances, in the order the reader is offered them. */
export const APPEARANCES: readonly Appearance[] = ["light", "dark", "system", "story"];

/** A catalogue's lists with the defaults filled in, and its switches: what the shell and the frame read. */
export type CatalogueSettings = {
  /** The prefix of what the browser stores for the catalogue. */
  readonly id: string;
  /** The switches of the toolbar and the View menu. */
  readonly switches: readonly ViewSwitch[];
  /** The touch switch the stories marked for a phone are drawn with; none when there is none to draw them with. */
  readonly touch: TouchChoice | undefined;
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
  /** The panel's tabs shown, Forgebook's then the plugins', by id. */
  readonly tabs: readonly string[];
  /** The accessibility rules. */
  readonly a11y: A11ySettings;
  /** The measuring grid's step, in CSS px. */
  readonly gridStep: number;
  /** The shell's texts replaced, by name. */
  readonly strings: Readonly<Record<string, string>>;
  /** Forgebook's own controls shown, in their order. */
  readonly ownControls: readonly OwnControlId[];
  /** The controls that start on the toolbar, in their order, by id. */
  readonly toolbar: readonly string[];
  /** Whether a component's page offers "Used in". */
  readonly hasUsedIn: boolean;
  /** Who a component's page is read by when the address does not say. */
  readonly audience: AudienceId;
  /** Whether the story bar offers the Embed button. */
  readonly hasEmbed: boolean;
  /** The shell's appearance before a reader picks one. */
  readonly appearance: Appearance;
  /** The keys that cycle the controls, by control id. */
  readonly keys: ControlKeys;
  /** The catalogue's named views, their values in the address's form. */
  readonly views: readonly { readonly name: string; readonly query: string }[];
  /** The prop groups listed first, in their order; none by default. */
  readonly propGroups: readonly string[];
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
 * The controls that start on the toolbar when the configuration names none: the colour scheme, the contrast and the
 * width, those the catalogue has.
 *
 * @param switches - the catalogue's switches.
 * @param ownControls - Forgebook's own controls shown.
 */
const defaultToolbar = (switches: readonly ViewSwitch[], ownControls: readonly OwnControlId[]): string[] => [
  ...[switchWithRole(switches, "colorScheme"), switchWithRole(switches, "contrast")].flatMap((each) =>
    each === undefined ? [] : [each.id]
  ),
  ...(ownControls.includes("width") ? ["width"] : [])
];

/**
 * Why the toolbar a configuration names cannot be used, or none: every id a control there is (a switch, or one of
 * Forgebook's own, shown or turned off), once. A name that is no control at all is a mistake to say; a control turned
 * off is only left out, since a preset and the catalogue may each set one of the two.
 *
 * @param toolbar - the ids it names.
 * @param switches - the catalogue's switches.
 */
const toolbarProblem = (toolbar: readonly string[], switches: readonly ViewSwitch[]): string | undefined => {
  const known = new Set<string>([...switches.map((each) => each.id), ...OWN_CONTROL_IDS]);
  const unknown = toolbar.find((id) => !known.has(id));
  if (unknown !== undefined) return `The toolbar names "${unknown}", which is no control of the catalogue`;
  const twice = toolbar.find((id, index) => toolbar.indexOf(id) !== index);
  if (twice !== undefined) return `The toolbar names "${twice}" twice`;
  return undefined;
};

/**
 * The catalogue's keys.
 *
 * @param controlIds - the ids of its controls.
 * @param set - the keys its configuration sets.
 * @throws when a key cannot be used.
 */
const usableKeys = (controlIds: readonly string[], set: CatalogueLists["keys"]): ControlKeys => {
  const keys = catalogueKeys(controlIds, set);
  if (typeof keys === "string") throw new Error(`Forgebook's keys: ${keys}`);
  return keys;
};

/**
 * The catalogue's named views, their values in the address's form.
 *
 * @param switches - its switches, for the views written as words.
 * @param views - the views its configuration names; none by default.
 * @throws when a view cannot be read.
 */
const catalogueViews = (
  switches: readonly ViewSwitch[],
  views: readonly CatalogueView[] = []
): { readonly name: string; readonly query: string }[] =>
  views.map((each) => {
    const read = viewQuery(each.view, switches);
    if ("error" in read) throw new Error(`Forgebook's view "${each.name}": ${read.error}`);
    return { name: each.name, query: read.query };
  });

/**
 * The groups a catalogue names, of stories and of props, none by default.
 *
 * @param lists - the lists its configuration sets.
 */
const namedGroups = (lists: CatalogueLists): Pick<CatalogueSettings, "storyGroups" | "propGroups"> => ({
  storyGroups: lists.storyGroups ?? [],
  propGroups: lists.propGroups ?? []
});

/**
 * A catalogue's settings, its lists' defaults filled in.
 *
 * @param title - the catalogue's title, for its storage's id.
 * @param switches - its switches.
 * @param lists - the lists its configuration sets.
 * @param pluginTabs - the ids of the tabs its plugins add.
 * @throws when the toolbar it names holds an id that is no control at all, or one twice; or a key it sets cannot be
 *   used; or a view it names cannot be read.
 */
export const catalogueSettings = (
  title: string,
  switches: readonly ViewSwitch[],
  lists: CatalogueLists = {},
  pluginTabs: readonly string[] = []
): CatalogueSettings => {
  const { audience = DEFAULT_AUDIENCE } = lists;
  const builtIn = lists.backgrounds?.builtIn;
  const offered =
    builtIn === false
      ? []
      : BUILT_IN_BACKDROPS.filter((backdrop) => builtIn === undefined || builtIn.includes(backdrop.id));
  const tabsOff = lists.tabs ?? {};
  const controlsOff = lists.controls ?? {};
  const ownControls = OWN_CONTROL_IDS.filter((control) => controlsOff[control] !== false);
  const named = lists.toolbar ?? defaultToolbar(switches, ownControls);
  const problem = toolbarProblem(named, switches);
  if (problem !== undefined) throw new Error(`Forgebook's toolbar: ${problem}`);
  const toolbar = named.filter(
    (id) => !OWN_CONTROL_IDS.some((own) => own === id && !ownControls.includes(own))
  );
  return {
    id: lists.id ?? idOf(title),
    switches,
    touch: touchChoiceOf(switches),
    widths: lists.widths ?? DEFAULT_WIDTHS,
    widthRange: lists.widthRange ?? { min: 240, max: 2560 },
    zooms: withHundred(lists.zooms, [50, 75, 100, 125, 150, 200]),
    textSizes: withHundred(lists.textSizes, [100, 125, 150]),
    backdrops: [...offered, ...(lists.backgrounds?.custom ?? []).map(customBackdrop)],
    ...namedGroups(lists),
    tabs: [...PANEL_TAB_IDS, ...pluginTabs].filter((tab) => tabsOff[tab] !== false),
    a11y: {
      tags: lists.a11y?.tags ?? DEFAULT_A11Y_TAGS,
      disabledRules: lists.a11y?.disabledRules ?? []
    },
    gridStep: lists.gridStep ?? 8,
    strings: lists.strings ?? {},
    ownControls,
    toolbar,
    hasUsedIn: lists.usedIn !== false,
    audience,
    hasEmbed: controlsOff.embed !== false,
    appearance: lists.appearance ?? "system",
    keys: usableKeys([...switches.map((each) => each.id), ...ownControls], lists.keys),
    views: catalogueViews(switches, lists.views)
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
