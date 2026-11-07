/**
 * What a catalogue's configuration may set on its switches' values, checked on Node before anything runs: a gallery's
 * previews, what a value implies, a value's own style sheet; and their files' paths made absolute.
 *
 * @remarks
 * Only here, not in `switches.ts`: a page has no use for these answers, and they need the files, so a first load carries
 * none of it. A preview and a sheet are never named by an address, which is what the checks on their paths and values
 * hold: a preset's remote picture or font would make every reader of the catalogue call a server its author may never
 * have chosen. A sheet's contents are not read: like a source's sheets, it is the author's own CSS, compiled by Vite, and
 * what it imports is theirs to decide.
 *
 * @module
 */
import { existsSync } from "node:fs";

import {
  LANGUAGE_SWITCH_ID,
  type SwitchPreview,
  type SwitchValue,
  switchControl,
  type ViewSwitch
} from "../switches.ts";
import { VITE_PATHS, type VitePaths } from "./vitePaths.ts";

/** The most colours a preview shows: past them, none has room to read. */
const MAX_SWATCHES = 8;

/** The longest font name a preview takes: a family's name, never a list or a rule. */
const MAX_FONT_NAME = 64;

/** A scheme, or a `//` or `\\` address: what makes a path an address. A drive letter (`C:\`) has one letter only. */
const ADDRESS = /^(?:[a-z][a-z0-9+.-]+:|\/\/|\\\\)/i;

/** The pictures a browser draws in an `img`. */
const PICTURE_FILE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

/** The style sheets Vite compiles. */
const SHEET_FILE = /\.(?:css|less|sass|scss|styl|stylus)$/i;

/** A colour as CSS writes one: a word, a hex or a function of plain numbers; never `url()` or a rule. */
const COLOUR =
  /^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([0-9a-z.,%/\s-]+\))$/i;

/** A font's name: letters, digits, spaces and dashes, in any script. */
const FONT_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

/**
 * Why a value's file cannot be used, or none.
 *
 * @param what - what names it in the answer.
 * @param path - the file, as the configuration writes it.
 * @param file - which files it may be.
 * @param kinds - their kinds, for the answer.
 * @param dir - the configuration's folder.
 * @param paths - how paths are read.
 */
const fileProblem = (
  what: string,
  path: unknown,
  file: RegExp,
  kinds: string,
  dir: string,
  paths: VitePaths
): string | undefined => {
  if (typeof path !== "string" || path === "") return `${what} must be a file's path`;
  if (ADDRESS.test(path))
    return `${what} is an address ("${path}"): give a file's path, nothing is loaded from an address`;
  if (!file.test(path)) return `${what} must be ${kinds} ("${path}")`;
  return existsSync(paths.resolve(dir, path)) ? undefined : `${what} names no file ("${path}")`;
};

/**
 * Why a value's preview cannot be used, or none.
 *
 * @param what - what names it in the answer.
 * @param preview - the preview, as the configuration writes it.
 * @param dir - the configuration's folder.
 * @param paths - how paths are read.
 */
const previewProblem = (
  what: string,
  preview: SwitchPreview,
  dir: string,
  paths: VitePaths
): string | undefined => {
  const keys = Object.keys(preview);
  const unknown = keys.find((key) => !["image", "swatches", "font"].includes(key));
  if (unknown !== undefined) return `${what} has no "${unknown}": it takes image, or swatches and font`;
  if ("image" in preview) {
    if (keys.length > 1) return `${what} takes image, or swatches and font, not both`;
    return fileProblem(what, preview.image, PICTURE_FILE, "a picture", dir, paths);
  }
  const { swatches, font } = preview;
  if (!Array.isArray(swatches) || swatches.length === 0 || swatches.length > MAX_SWATCHES)
    return `${what} needs image, or swatches: 1 to ${MAX_SWATCHES} colours`;
  const wrong = swatches.find((colour) => typeof colour !== "string" || !COLOUR.test(colour));
  if (wrong !== undefined) return `${what} has a swatch that is not a plain colour (${String(wrong)})`;
  if (
    font !== undefined &&
    (typeof font !== "string" || font.length > MAX_FONT_NAME || !FONT_NAME.test(font))
  )
    return `${what} has a font that is not a name (${String(font)}): one family's name, nothing is loaded for it`;
  return undefined;
};

/**
 * Why what a value implies cannot be used, or none: every switch and value named exists, a value does not imply its own
 * switch, and what it implies implies nothing further, so a view always has one answer.
 *
 * @param what - what names it in the answer.
 * @param each - the switch.
 * @param implies - the values it implies.
 * @param switches - the catalogue's switches.
 */
const impliesProblem = (
  what: string,
  each: ViewSwitch,
  implies: Readonly<Record<string, string>>,
  switches: readonly ViewSwitch[]
): string | undefined => {
  for (const [id, value] of Object.entries(implies)) {
    const target = switches.find((candidate) => candidate.id === id);
    // a source may offer languages this configuration does not know: the switch and its values exist only in the page
    if (id === LANGUAGE_SWITCH_ID) continue;
    if (target === undefined) return `${what} implies a switch there is not ("${id}")`;
    if (target === each) return `${what} implies its own switch`;
    const implied = target.values.find((candidate) => candidate.value === value);
    if (implied === undefined) return `${what} implies a value "${id}" does not have ("${value}")`;
    // Compare leaves out a value that only follows the system: a switch implied there would have no cell at all
    if (implied.scheme === "system") return `${what} implies ${id}=${value}, which only follows the system`;
    if (implied.implies !== undefined)
      return `${what} implies ${id}=${value}, which implies more: an implied value implies nothing further`;
  }
  return undefined;
};

/**
 * Why one value's settings cannot be used, or none.
 *
 * @param each - the switch.
 * @param value - the value.
 * @param switches - the catalogue's switches.
 * @param dir - the configuration's folder.
 * @param paths - how paths are read.
 */
const valueProblem = (
  each: ViewSwitch,
  value: SwitchValue,
  switches: readonly ViewSwitch[],
  dir: string,
  paths: VitePaths
): string | undefined => {
  const what = `The switch "${each.id}", value "${value.value}":`;
  if (value.preview !== undefined && switchControl(each) !== "gallery")
    return `${what} a preview shows only in a gallery: add control: "gallery" to the switch`;
  return (
    (value.preview === undefined
      ? undefined
      : previewProblem(`${what} its preview`, value.preview, dir, paths)) ??
    (value.implies === undefined ? undefined : impliesProblem(what, each, value.implies, switches)) ??
    (value.sheet === undefined
      ? undefined
      : fileProblem(`${what} its sheet`, value.sheet, SHEET_FILE, "a style sheet", dir, paths))
  );
};

/**
 * Why the settings of a catalogue's switches' values cannot be used, or none.
 *
 * @param switches - the catalogue's switches, the ready-made ones among them: a value may imply one.
 * @param dir - the configuration's folder.
 * @param paths - how paths are read; Vite's by default.
 */
export const switchValuesProblem = (
  switches: readonly ViewSwitch[],
  dir: string,
  paths: VitePaths = VITE_PATHS
): string | undefined => {
  for (const each of switches) {
    for (const value of each.values) {
      const problem = valueProblem(each, value, switches, dir, paths);
      if (problem !== undefined) return problem;
    }
  }
  return undefined;
};

/**
 * The switches with their values' files as absolute paths, as the generated pages import them. Their settings are
 * checked already.
 *
 * @param switches - the catalogue's switches.
 * @param dir - the configuration's folder.
 * @param paths - how paths are read; Vite's by default.
 */
export const withAbsoluteValueFiles = (
  switches: readonly ViewSwitch[],
  dir: string,
  paths: VitePaths = VITE_PATHS
): readonly ViewSwitch[] =>
  switches.map((each) => ({
    ...each,
    values: each.values.map(
      (value): SwitchValue => ({
        ...value,
        ...(value.sheet === undefined ? {} : { sheet: paths.resolve(dir, value.sheet) }),
        ...(value.preview !== undefined && "image" in value.preview
          ? { preview: { image: paths.resolve(dir, value.preview.image) } }
          : {})
      })
    )
  }));
