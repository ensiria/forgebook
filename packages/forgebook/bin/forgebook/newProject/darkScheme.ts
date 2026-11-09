/**
 * Whether a project's dark scheme is a `.dark` class on the page, as Tailwind's class strategy, shadcn's themes and
 * Nuxt's color-mode write it; `forgebook init` then writes the theme switch to set that class, since Forgebook's own
 * sets `data-theme`, and a dark view would draw light.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { contrastSwitch, themeSwitch, type ViewSwitch } from "../../../src/switches.ts";
import { isSearched, readableEntries, SEARCH_LIMIT } from "./projectWalk.ts";

/** The style sheets read, by extension. */
const STYLE_SHEET = /\.(?:css|scss|sass|less|pcss|postcss)$/;

/** Tailwind's configuration files, at the project's root. */
const TAILWIND_CONFIGS = ["js", "cjs", "mjs", "ts", "cts", "mts"].map(
  (extension) => `tailwind.config.${extension}`
);

/** The largest file read, in bytes: a style sheet past it is a built one. */
const MAX_FILE_SIZE = 1_000_000;

/** How many style sheets are read at most. */
const MAX_SHEETS = 200;

/** A `.dark` class in a selector (`.dark`, `html.dark`, `.dark .card`), not a number's decimals nor a longer name. */
const DARK_CLASS = /(?<!\d)\.dark(?![\w-])/;

/** Tailwind 4's dark variant on a class (`@custom-variant dark (&:is(.dark *))`). */
const DARK_VARIANT = /@(?:custom-)?variant\s+dark\b[^;{]*\.dark\b/;

/** Tailwind 3's class or selector strategy, in its configuration. */
const DARK_MODE = /darkMode\s*:\s*\[?\s*["'](?:class|selector)["']/;

/** A `data-theme` attribute in a selector: the project already draws dark the way Forgebook's switch does. */
const DATA_THEME = /\[\s*data-theme\b/;

/** A text without its block comments, so a selector in a comment does not count. */
const withoutComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Whether texts of a project draw its dark scheme from a `.dark` class and not from `data-theme`.
 *
 * @param sheets - its style sheets' texts.
 * @param tailwindConfig - its Tailwind configuration's text; empty when it has none.
 */
export const isClassDarkScheme = (sheets: readonly string[], tailwindConfig: string): boolean => {
  const css = sheets.map(withoutComments);
  if (css.some((text) => DATA_THEME.test(text))) return false;
  return (
    DARK_MODE.test(tailwindConfig) || css.some((text) => DARK_VARIANT.test(text) || DARK_CLASS.test(text))
  );
};

/** A file's text; empty past the size read. */
const readSmall = (path: string): string =>
  statSync(path).size > MAX_FILE_SIZE ? "" : readFileSync(path, "utf8");

/** The project's style sheets, as far as the search goes. */
const styleSheetsOf = (projectDir: string): readonly string[] => {
  const sheets: string[] = [];
  const queue = [projectDir];
  for (const dir of queue) {
    if (queue.length > SEARCH_LIMIT || sheets.length >= MAX_SHEETS) break;
    const entries = readableEntries(dir);
    for (const entry of entries) {
      if (isSearched(entry)) queue.push(join(dir, entry.name));
      else if (entry.isFile() && STYLE_SHEET.test(entry.name)) sheets.push(join(dir, entry.name));
    }
  }
  return sheets.slice(0, MAX_SHEETS);
};

/**
 * Whether a project draws its dark scheme from a `.dark` class: its style sheets and its Tailwind configuration read.
 *
 * @param projectDir - the project's folder.
 */
export const hasClassDarkScheme = (projectDir: string): boolean => {
  const config = TAILWIND_CONFIGS.map((name) => join(projectDir, name)).find((path) => existsSync(path));
  return isClassDarkScheme(
    styleSheetsOf(projectDir).map(readSmall),
    config === undefined ? "" : readSmall(config)
  );
};

/** The view switches of a project whose dark scheme is a `.dark` class: the theme as that class, and the contrast. */
export const classDarkSwitches = (): readonly ViewSwitch[] => [
  { ...themeSwitch(), apply: { kind: "class", prefix: "" } },
  contrastSwitch()
];
