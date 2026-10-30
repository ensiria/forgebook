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
 * texts and the language's provider).
 */
export type SwitchRole = "colorScheme" | "contrast" | "language";

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
  languages: readonly { readonly id: string; readonly label: string }[]
): ViewSwitch => ({
  id: LANGUAGE_SWITCH_ID,
  label: "Language",
  role: "language",
  apply: { kind: "code" },
  control: "list",
  default: "",
  values: [
    { value: "", label: "Stories' own", isUnset: true },
    ...languages.map((language) => ({ value: language.id, label: language.label }))
  ]
});

/**
 * The switch with a role, among a catalogue's.
 *
 * @param switches - the switches.
 * @param role - the role.
 */
export const switchWithRole = (switches: readonly ViewSwitch[], role: SwitchRole): ViewSwitch | undefined =>
  switches.find((each) => each.role === role);

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
 * source offers languages, the language switch over all of them.
 *
 * @param declared - the switches the catalogue declares; none for the default ones.
 * @param languages - every language the catalogue and its sources offer, by id and name; the first of an id wins.
 * @throws when the switches cannot be used (`switchesProblem`): a catalogue's configuration error, shown at once.
 */
export const catalogueSwitches = (
  declared: readonly ViewSwitch[] | undefined,
  languages: readonly { readonly id: string; readonly label: string }[]
): readonly ViewSwitch[] => {
  const unique = languages.filter(
    (language, index) => languages.findIndex((other) => other.id === language.id) === index
  );
  const switches = [
    ...(declared ?? DEFAULT_SWITCHES),
    ...(unique.length > 0 ? [languageSwitch(unique)] : [])
  ];
  const problem = switchesProblem(switches);
  if (problem !== undefined) throw new Error(`Forgebook's switches: ${problem}`);
  return switches;
};
