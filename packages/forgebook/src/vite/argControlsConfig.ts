/**
 * A catalogue's custom controls, its own and its presets', checked and merged: what the pages load and what the props
 * docs are matched against.
 *
 * @remarks
 * A preset's control runs in the catalogue's page as the catalogue's own do, so it passes the same checks: a name a story
 * can write that no control of the panel has, and a module named as a path or a package's specifier, never an address
 * (`https:`, `data:`) that would load code from elsewhere. A preset names its files by absolute path, as its preview: a
 * relative path would be read from wherever the catalogue is; nor can it take every prop of a keyword type (`string`). The catalogue's
 * registration of a name replaces a preset's, and `false` removes it; a later preset's replaces an earlier one's. The
 * order kept is the precedence among controls that match the same prop: the catalogue's first, then the presets' in
 * their order.
 *
 * @module
 */
import { resolve } from "node:path";

import { CONTROLS } from "../storyArgTypes.ts";
import type { ArgControlMatch, ForgebookConfig } from "./config.ts";

/** A custom control ready for the pages. */
export type ResolvedArgControl = {
  /** Its module, drawn in the panel: a path absolute, a package's specifier as written. */
  readonly module: string;
  /** Its frame module, which turns its value into the story's; none when the story receives the JSON value. */
  readonly frame?: string;
  /** The props it takes in every story that names no control for them; empty when only `argTypes` name it. */
  readonly matches: readonly ArgControlMatch[];
};

/** The custom controls by name, in their precedence: the catalogue's, then its presets'. */
export type ResolvedArgControls = Readonly<Record<string, ResolvedArgControl>>;

/** The keys a control's option may have. */
const OPTION_KEYS: readonly string[] = ["module", "frame", "matches"];

/** The keys a match may have. */
const MATCH_KEYS: readonly string[] = ["typeName", "propName"];

/** The type names TypeScript writes as keywords: a preset that takes one by type alone would take most of a catalogue. */
const KEYWORD_TYPES: readonly string[] = [
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "object",
  "unknown",
  "any",
  "null",
  "undefined",
  "never",
  "void"
];

/** An address with a scheme (`https:`, `data:`), which would load code from elsewhere; a Windows drive's letter is none. */
const SCHEME = /^[A-Za-z][\w+.-]+:/;

/** Whether a value is an object that is not a list. */
const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A key of an object no version reads, when it has one.
 *
 * @param value - the object.
 * @param known - its keys.
 */
const unknownKey = (value: object, known: readonly string[]): string | undefined =>
  Object.keys(value).find((key) => !known.includes(key));

/**
 * One field of a match, checked: a text, or none.
 *
 * @param match - the match.
 * @param key - the field.
 * @param where - where it is written, for a problem.
 */
const matchField = (match: object, key: string, where: string): string | undefined => {
  const value: unknown = Reflect.get(match, key);
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value === "") throw new Error(`${where}: a match's ${key} is no name`);
  return value;
};

/**
 * The matches a control's option writes, checked.
 *
 * @param value - its `matches`.
 * @param where - where it is written, for a problem.
 */
const matchesOf = (value: unknown, where: string): ArgControlMatch[] => {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((match: unknown): ArgControlMatch => {
    if (!isObject(match)) throw new Error(`${where}: a match is an object ({ typeName } or { propName })`);
    const key = unknownKey(match, MATCH_KEYS);
    if (key !== undefined)
      throw new Error(`${where}: a match has no key "${key}"; it takes typeName, propName`);
    const typeName = matchField(match, "typeName", where);
    const propName = matchField(match, "propName", where);
    if (typeName === undefined && propName === undefined)
      throw new Error(`${where}: a match names a typeName, a propName, or both`);
    return {
      ...(typeName === undefined ? {} : { typeName }),
      ...(propName === undefined ? {} : { propName })
    };
  });
};

/** How the modules a list of controls names are placed: from the catalogue's folder, or as a preset writes them. */
type ModulePlace = (module: unknown, where: string) => string;

/**
 * One control, checked and resolved; `false` removes a preset's control of its name.
 *
 * @param name - its name.
 * @param value - what the list writes for it.
 * @param where - where the list is, for a problem.
 * @param place - places a module it names.
 */
const resolvedControl = (
  name: string,
  value: unknown,
  where: string,
  place: ModulePlace
): ResolvedArgControl | false => {
  const at = `${where}: "${name}"`;
  if (Object.hasOwn(CONTROLS, name)) throw new Error(`${at} is a control of the panel already`);
  if (!/^[A-Za-z][\w-]*$/.test(name)) throw new Error(`${at} is no name a control can have`);
  if (value === false) return false;
  if (!isObject(value)) return { module: place(value, at), matches: [] };
  const key = unknownKey(value, OPTION_KEYS);
  if (key !== undefined) throw new Error(`${at} has no key "${key}"; it takes ${OPTION_KEYS.join(", ")}`);
  const frame: unknown = Reflect.get(value, "frame");
  return {
    module: place(Reflect.get(value, "module"), at),
    ...(frame === undefined ? {} : { frame: place(frame, `${at}: its frame`) }),
    matches: matchesOf(Reflect.get(value, "matches"), at)
  };
};

/**
 * A list's controls, checked and resolved, in its order.
 *
 * @param controls - the list.
 * @param where - where it is, for a problem.
 * @param place - places a module it names.
 */
const listed = (
  controls: Readonly<Record<string, unknown>> | undefined,
  where: string,
  place: ModulePlace
): [string, ResolvedArgControl | false][] => {
  if (controls !== undefined && !isObject(controls))
    throw new Error(`${where} is an object of controls by name`);
  return Object.entries(controls ?? {}).map(([name, value]) => [
    name,
    resolvedControl(name, value, where, place)
  ]);
};

/** The path functions the resolution needs, so a test can name another system's. */
export type ControlPaths = {
  /** A path from the configuration's folder, made absolute in Vite's form. */
  readonly absolute: (path: string) => string;
  /** Whether a path is absolute already. */
  readonly isAbsolute: (path: string) => boolean;
  /** An absolute path in Vite's form. */
  readonly normalize: (path: string) => string;
};

/**
 * The catalogue's custom controls and its presets', checked, merged, in their precedence.
 *
 * @param config - the configuration, its presets included.
 * @param dir - its folder.
 * @param paths - the path functions.
 * @throws when a name, a module or a match cannot be used.
 */
export const resolvedArgControls = (
  config: Pick<ForgebookConfig, "argControls" | "presets">,
  dir: string,
  paths: ControlPaths
): ResolvedArgControls => {
  const file = resolve(dir, "forgebook.config");
  const named = (module: unknown, where: string): string => {
    if (typeof module !== "string" || module === "")
      throw new Error(`${where} names no module, as a path or a package's specifier`);
    if (SCHEME.test(module))
      throw new Error(`${where} names an address, not a path or a package's specifier`);
    return module;
  };
  const own = listed(config.argControls, `${file}: argControls`, (module, where) => {
    const path = named(module, where);
    return path.startsWith(".") || paths.isAbsolute(path) ? paths.absolute(path) : path;
  });
  // a later preset's control replaces an earlier one's of the same name, where the first was
  const fromPresets = new Map<string, ResolvedArgControl | false>();
  for (const preset of config.presets ?? []) {
    const where = `${file}: its preset "${preset.name}": argControls`;
    for (const [name, control] of listed(preset.argControls, where, (module, at) => {
      const path = named(module, at);
      if (path.startsWith(".")) throw new Error(`${at}: a preset names a module by absolute path or package`);
      return paths.isAbsolute(path) ? paths.normalize(path) : path;
    })) {
      if (control === false) throw new Error(`${where}: "${name}": only a catalogue removes a control`);
      const keyword = control.matches.find(
        (match) => match.propName === undefined && KEYWORD_TYPES.includes(match.typeName ?? "")
      );
      if (keyword !== undefined)
        throw new Error(
          `${where}: "${name}": a preset takes no "${keyword.typeName}" prop by its type alone`
        );
      fromPresets.set(name, control);
    }
  }
  // a removal that removes nothing is a misspelt name
  const removing = own.find(([name, control]) => control === false && !fromPresets.has(name));
  if (removing !== undefined)
    throw new Error(`${file}: argControls: "${removing[0]}" is no preset's control to remove`);
  const ownNames = new Set(own.map(([name]) => name));
  return Object.fromEntries(
    [...own, ...[...fromPresets].filter(([name]) => !ownNames.has(name))].flatMap(
      ([name, control]): [string, ResolvedArgControl][] => (control === false ? [] : [[name, control]])
    )
  );
};
