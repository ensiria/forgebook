/**
 * The switches of the toolbar and the View menu, as a catalogue declares them: what each offers, where it applies,
 * and the two roles the catalogue itself reads (the colour scheme and the contrast).
 *
 * @remarks
 * Forgebook knows no library's switches: a catalogue (or, from phase 4, a library's preset) declares them, as
 * Storybook's `globalTypes`. A switch applies either on the frame's root, live (an attribute, a class, the
 * `color-scheme`, a custom property), or by code: the story reads it as `context.globals`. Its value lives in the
 * address (`?<id>=<value>`, only when it is not the default). The theme and the contrast are switches like the others,
 * ready-made here; a catalogue that declares none gets them. The language a catalogue offers is a switch the frame
 * applies by code (`languageSwitch`). Pure.
 *
 * @module
 */

/** One value a switch offers. */
export type SwitchValue = {
  /** The value, as the address and the root's attribute write it (`dark`). */
  readonly value: string;
  /** Its name in the toolbar or the View menu (`Dark`). */
  readonly label: string;
  /** Whether the value is the library's own: the switch then writes nothing on the root (`theme=system`). */
  readonly isUnset?: boolean;
  /** For a `colorScheme` switch: the scheme the value draws in; `system` follows the system. */
  readonly scheme?: "light" | "dark" | "system";
  /** For a `contrast` switch: whether the value is the higher contrast. */
  readonly isMore?: boolean;
  /** For a `language` switch: whether the language reads right to left, which draws the story right to left. */
  readonly isRightToLeft?: boolean;
};

/** Where a switch applies. */
export type SwitchApply =
  /** An attribute on the frame's root (`data-theme`). */
  | { readonly kind: "attribute"; readonly name: string }
  /** A class on the frame's root, the value after a prefix (`theme-dark`). */
  | { readonly kind: "class"; readonly prefix: string }
  /** The root's `color-scheme`. */
  | { readonly kind: "colorScheme" }
  /** A custom property on the root (`--density`). */
  | { readonly kind: "cssVariable"; readonly name: string }
  /** Nothing on the root: the story reads the value as `context.globals[id]` (a provider, a prop). */
  | { readonly kind: "code" };

/**
 * What the catalogue itself reads of a switch: the colour scheme (the loading boxes' and backgrounds' colours, the
 * tests' themes), the contrast (the source's more-contrast colours, the tests' variants), the language (the stories'
 * texts and the language's provider), the direction (a catalogue's own switch in place of the ready-made one).
 */
export type SwitchRole = "colorScheme" | "contrast" | "language" | "direction" | "touch";

/** A switch of the toolbar or the View menu. */
export type ViewSwitch = {
  /** A stable id, the address's parameter (`theme`). */
  readonly id: string;
  /** Its name in the toolbar or the View menu (`Theme`). */
  readonly label: string;
  /** Its values, in their order. */
  readonly values: readonly SwitchValue[];
  /** The value when the address names none. */
  readonly default: string;
  /** Where it applies. */
  readonly apply: SwitchApply;
  /** What the catalogue reads of it; none for a switch only the library reads. */
  readonly role?: SwitchRole;
  /** How the View menu offers it: a row of segments (by default, up to six values) or a list. */
  readonly control?: "segments" | "list";
  /** What a reader should know of it, in a sentence or two: under its row in the View menu and in its tooltip. */
  readonly description?: string;
};

/** The address's own parameters: a switch may not take their names. */
const RESERVED_IDS = [
  "story",
  "component",
  "backdrop",
  "sheets",
  "text",
  "compare",
  "width",
  "height",
  "panel",
  "tab",
  "zoom",
  "tools",
  "device",
  "orientation",
  "args",
  "matrix",
  "clock"
];

/**
 * Why a list of switches cannot be used, or none: ids unique and not the address's own, a default among the values,
 * at most one switch per role.
 *
 * @param switches - the declared switches.
 */
export const switchesProblem = (switches: readonly ViewSwitch[]): string | undefined => {
  const ids = new Set<string>();
  const roles = new Set<SwitchRole>();
  for (const each of switches) {
    if (ids.has(each.id)) return `Two switches are named "${each.id}"`;
    if (RESERVED_IDS.includes(each.id))
      return `"${each.id}" is a parameter of the address, not a switch's name`;
    if (!each.values.some((value) => value.value === each.default))
      return `The switch "${each.id}" has no value "${each.default}", its default`;
    if (each.role !== undefined) {
      if (roles.has(each.role)) return `Two switches have the role "${each.role}"`;
      roles.add(each.role);
    }
    ids.add(each.id);
  }
  return undefined;
};

/** The theme: light, dark, or the system's (no attribute), on `data-theme`. */
export const themeSwitch = (): ViewSwitch => ({
  id: "theme",
  label: "Theme",
  role: "colorScheme",
  apply: { kind: "attribute", name: "data-theme" },
  default: "light",
  values: [
    { value: "light", label: "Light", scheme: "light" },
    { value: "dark", label: "Dark", scheme: "dark" },
    { value: "system", label: "System", scheme: "system", isUnset: true }
  ]
});

/** The contrast: standard or more, on `data-contrast`. */
export const contrastSwitch = (): ViewSwitch => ({
  id: "contrast",
  label: "More contrast",
  role: "contrast",
  apply: { kind: "attribute", name: "data-contrast" },
  default: "standard",
  values: [
    { value: "standard", label: "Standard", isMore: false },
    { value: "more", label: "More contrast", isMore: true }
  ]
});

/** The switches of a catalogue that declares none: the theme and the contrast. */
export const DEFAULT_SWITCHES: readonly ViewSwitch[] = [themeSwitch(), contrastSwitch()];

/** The language switch's id, the address's `lang` parameter. */
export const LANGUAGE_SWITCH_ID = "lang";

/**
 * The language switch for the languages a story can be drawn in: the stories' own text, then each language. Applied
 * by code: the frame hands the story the language's texts and provider.
 *
 * @param languages - the languages, by id and name.
 */
export const languageSwitch = (
  languages: readonly { readonly id: string; readonly label: string; readonly dir?: "rtl" }[]
): ViewSwitch => ({
  id: LANGUAGE_SWITCH_ID,
  label: "Language",
  role: "language",
  apply: { kind: "code" },
  control: "list",
  default: "",
  values: [
    { value: "", label: "Stories' own", isUnset: true },
    ...languages.map((language) => ({
      value: language.id,
      label: language.label,
      ...(language.dir === "rtl" ? { isRightToLeft: true } : {})
    }))
  ]
});

/**
 * The direction the stories are drawn in: left to right (the root's own, no attribute) or right to left, as `dir` on
 * the frame's root, so a library sees every component mirrored as a right-to-left page shows it.
 */
export const directionSwitch = (): ViewSwitch => ({
  id: "dir",
  label: "Direction",
  role: "direction",
  apply: { kind: "attribute", name: "dir" },
  default: "ltr",
  values: [
    { value: "ltr", label: "Left to right", isUnset: true },
    { value: "rtl", label: "Right to left" }
  ]
});

/**
 * How the stories are touched: with the mouse (no attribute), or as a finger, simulated in the frame
 * (`data-forgebook-touch` on its root: the frame's touch layer and the catalogue's CSS rewrite read it). A simulation:
 * events made by a page are not trusted, so native scrolling, focus, a virtual keyboard and real Safari stay a
 * device's, or `forgebook dev --touch`'s.
 */
export const touchSwitch = (): ViewSwitch => ({
  id: "touch",
  label: "Touch",
  role: "touch",
  description:
    "Simulated: the story receives a finger's events and a phone's hover and pointer media, Shift for two fingers. " +
    "Native scrolling, focus from a touch, the virtual keyboard and real Safari still need a device, or " +
    "forgebook dev --touch for Chromium's real touch.",
  apply: { kind: "attribute", name: "data-forgebook-touch" },
  default: "mouse",
  values: [
    { value: "mouse", label: "Mouse", isUnset: true },
    { value: "touch", label: "Touch" }
  ]
});

/** The ready-made switches a catalogue may turn off (`controls: { direction: false }`). */
export type ReadySwitchesOff = Readonly<Partial<Record<"direction" | "touch", false>>>;

/**
 * The switch with a role, among a catalogue's.
 *
 * @param switches - the switches.
 * @param role - the role.
 */
export const switchWithRole = (switches: readonly ViewSwitch[], role: SwitchRole): ViewSwitch | undefined =>
  switches.find((each) => each.role === role);

/** The touch switch and its two values: a finger and the mouse. */
export type TouchChoice = {
  /** The switch's id. */
  readonly id: string;
  /** Its value for a finger (`touch`). */
  readonly touch: string;
  /** Its value for the mouse: its default, or its first other value when the default is the finger. */
  readonly mouse: string;
};

/**
 * The touch switch a story marked for a phone (`parameters.touch`) is drawn with, or none when the catalogue has no
 * touch switch with a `touch` value (turned off, or a catalogue's own with other values).
 *
 * @param switches - the catalogue's switches.
 */
export const touchChoiceOf = (switches: readonly ViewSwitch[]): TouchChoice | undefined => {
  const touch = switchWithRole(switches, "touch");
  if (touch === undefined || !touch.values.some((value) => value.value === "touch")) return undefined;
  const mouse =
    touch.default === "touch" ? touch.values.find((value) => value.value !== "touch")?.value : touch.default;
  return mouse === undefined ? undefined : { id: touch.id, touch: "touch", mouse };
};

/**
 * A switch's value as declared, for a value an address or a message gives.
 *
 * @param each - the switch.
 * @param value - the value given; none for the default.
 */
export const switchValueOf = (each: ViewSwitch, value: string | undefined): SwitchValue | undefined =>
  each.values.find((candidate) => candidate.value === (value ?? each.default));

/**
 * How the View menu offers a switch: as it declares, or segments up to six values and a list past them.
 *
 * @param each - the switch.
 */
export const switchControl = (each: ViewSwitch): "segments" | "list" =>
  each.control ?? (each.values.length <= 6 ? "segments" : "list");

/**
 * A catalogue's switches: the ones it declares (the theme and the contrast when it declares none), then, when it or a
 * source offers languages, the language switch over all of them, then the ready-made direction and touch switches,
 * each unless the catalogue declares its own (the `direction` or `touch` role) or turned it off.
 *
 * @param declared - the switches the catalogue declares; none for the default ones.
 * @param languages - every language the catalogue and its sources offer, by id and name; the first of an id wins.
 * @param turnedOff - the ready-made switches the catalogue turned off (its `controls`); none by default.
 * @throws when the switches cannot be used (`switchesProblem`): a catalogue's configuration error, shown at once.
 */
export const catalogueSwitches = (
  declared: readonly ViewSwitch[] | undefined,
  languages: readonly { readonly id: string; readonly label: string; readonly dir?: "rtl" }[],
  turnedOff: ReadySwitchesOff = {}
): readonly ViewSwitch[] => {
  const unique = languages.filter(
    (language, index) => languages.findIndex((other) => other.id === language.id) === index
  );
  const own = declared ?? DEFAULT_SWITCHES;
  // a ready-made switch steps aside for a catalogue's own: of its role, or of its id (one declared before it existed)
  const isOffered = (role: "direction" | "touch", ready: ViewSwitch): boolean =>
    turnedOff[role] !== false &&
    switchWithRole(own, role) === undefined &&
    !own.some((each) => each.id === ready.id);
  const direction = directionSwitch();
  const touch = touchSwitch();
  const switches = [
    ...own,
    ...(unique.length > 0 ? [languageSwitch(unique)] : []),
    ...(isOffered("direction", direction) ? [direction] : []),
    ...(isOffered("touch", touch) ? [touch] : [])
  ];
  const problem = switchesProblem(switches);
  if (problem !== undefined) throw new Error(`Forgebook's switches: ${problem}`);
  return switches;
};

/** What a switch made from a `globalType` may take besides it: where it applies, what the catalogue reads of it. */
export type GlobalTypeSwitchOverride = Partial<Pick<ViewSwitch, "label" | "apply" | "role" | "control">>;

/** How `switchesFromGlobalTypes` reads Storybook's preview. */
export type GlobalTypesOptions = {
  /** The preview's `initialGlobals`: each switch's default, over the `globalType`'s `defaultValue`. */
  readonly initialGlobals?: Readonly<Record<string, unknown>>;
  /**
   * What each switch takes besides its `globalType`, by id: by default a switch applies by code (the story's
   * decorators read `context.globals`, as Storybook's do) and the catalogue reads nothing of it.
   */
  readonly overrides?: Readonly<Record<string, GlobalTypeSwitchOverride>>;
};

/** The globals of Storybook's own addons: the catalogue has its own background, width and measuring tools. */
const ADDON_GLOBALS = ["backgrounds", "viewport", "measureEnabled", "outline", "grid"];

/** Whether a value is a plain object. */
const isRecordValue = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The values of a `globalType`'s toolbar: each item a text, or `{ value, title }`; an item without a text value (a
 * reset) is left out.
 *
 * @param items - the toolbar's `items`.
 */
const globalTypeValues = (items: unknown): SwitchValue[] =>
  (Array.isArray(items) ? items : []).flatMap((item): SwitchValue[] => {
    if (typeof item === "string") return [{ value: item, label: item }];
    if (!isRecordValue(item) || typeof item["value"] !== "string") return [];
    const title = item["title"];
    return [{ value: item["value"], label: typeof title === "string" ? title : item["value"] }];
  });

/**
 * The catalogue's switches from Storybook's `globalTypes` (a toolbar of a preview's own globals): one switch per
 * `globalType` with toolbar items, applied by code, so the decorators that read `context.globals` work as in
 * Storybook. Its label is the toolbar's title (or the `globalType`'s `name`, or its id); its default the preview's
 * `initialGlobals`, or its `defaultValue`, or its first value. The globals of Storybook's addons and the address's
 * own names are left out.
 *
 * @param globalTypes - the preview's `globalTypes`, as plain data (the configuration reads it on Node).
 * @param options - the preview's `initialGlobals`, and what a switch takes besides its `globalType`.
 */
export const switchesFromGlobalTypes = (
  globalTypes: Readonly<Record<string, unknown>>,
  options: GlobalTypesOptions = {}
): ViewSwitch[] =>
  Object.entries(globalTypes).flatMap(([id, globalType]): ViewSwitch[] => {
    if (!isRecordValue(globalType) || ADDON_GLOBALS.includes(id) || RESERVED_IDS.includes(id)) return [];
    const toolbar = isRecordValue(globalType["toolbar"]) ? globalType["toolbar"] : {};
    const values = globalTypeValues(toolbar["items"]);
    const [first] = values;
    if (first === undefined) return [];
    const initial = options.initialGlobals?.[id] ?? globalType["defaultValue"];
    const title = toolbar["title"] ?? globalType["name"];
    return [
      {
        id,
        label: typeof title === "string" ? title : id,
        values,
        default: values.some((value) => value.value === initial) ? String(initial) : first.value,
        apply: { kind: "code" },
        ...options.overrides?.[id]
      }
    ];
  });
