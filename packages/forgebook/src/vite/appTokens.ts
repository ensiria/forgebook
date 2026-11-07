/**
 * The design system an application already has, read from its files with nothing written for it: custom properties,
 * Tailwind's `@theme` and configuration, and what shadcn's `components.json` points at.
 *
 * @remarks
 * Nobody writes a tokens file for a catalogue they did not ask for, and an agent that finds no tokens writes colours by
 * hand, so this is what a catalogue with no tokens file reads. No project code runs: the files are read as text
 * (`appTokenFiles.ts`, `tailwindConfigTokens.ts`). Tailwind's default theme counts, since a project on Tailwind has it
 * whether or not it writes any of its own, but it comes last in a list: it is not what makes this project's system.
 *
 * Later sources stand over earlier ones, and a difference between two files is a clash, reported as a tokens file's
 * would be: other sheets, then the configuration, then the sheet `components.json` names.
 *
 * @module
 */
import { realpathSync } from "node:fs";
import { dirname, relative } from "node:path";

import {
  packageFile,
  type ReadConfig,
  type ReadSheet,
  readConfigs,
  readSheets,
  shadcnConfig,
  smallFileText
} from "./appTokenFiles.ts";
import { type CssPlace, type CssReading, readCssText } from "./cssDeclarations.ts";
import { colorWrappers, resolvedTokens, type TokenDeclaration } from "./cssTokenValues.ts";
import type { DesignToken, TokenOrigin, TokenOriginKind, TokenSource } from "./designTokens.ts";
import { type ConfigToken, readTailwindPalette } from "./tailwindConfigTokens.ts";
import { type TokenClash, tokenClashes } from "./tokenClashes.ts";

/** What an application's files gave. */
export type AppTokens = {
  /** The tokens: the application's own first, Tailwind's defaults last. */
  readonly tokens: readonly DesignToken[];
  /** The names two files give different values, with whose stands. */
  readonly clashes: readonly TokenClash[];
  /** What was read. */
  readonly sources: readonly TokenSource[];
  /** What could not be read, which leaves tokens unknown; none of it stops a check. */
  readonly unread: readonly string[];
  /** Every file read, absolute. */
  readonly files: readonly string[];
};

/** A custom property's name, and no more. */
const TOKEN_NAME = /^--[\w.-]{1,100}$/;

/** Past this a value is not a token's, in characters. */
const LONGEST_TOKEN_VALUE = 500;

/** A block with this many custom properties is a system's root and not one component's variables. */
const SYSTEM_BLOCK = 12;

/** The steps of Tailwind's spacing scale that classes write, in units of its base. */
const SPACING_STEPS = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56,
  60, 64, 72, 80, 96
];

/** Plugins whose additions to the theme are not tokens worth saying they are unknown. */
const KNOWN_PLUGIN = /typography|forms|animate|container-queries|aspect-ratio/;

/** A path with forward slashes on every system, for an answer that travels. */
const toPosix = (path: string): string => path.replaceAll("\\", "/");

/** Selectors holding enough custom properties to be a system's root, in a sheet. */
const systemSelectors = ({ declarations }: CssReading): ReadonlySet<string> => {
  const counts = new Map<string, number>();
  for (const { place } of declarations) {
    if (place.kind === "selector") counts.set(place.selector, (counts.get(place.selector) ?? 0) + 1);
  }
  return new Set(
    [...counts].flatMap(([selector, count]) =>
      count >= SYSTEM_BLOCK && /^[.#[][\w-]+\]?$/.test(selector) ? [selector] : []
    )
  );
};

/** The kind and theme of a declaration read from a sheet, when it makes a token at all. */
const sheetToken = (
  place: CssPlace,
  system: ReadonlySet<string>
): { readonly kind: TokenOriginKind; readonly mode: string | undefined } | undefined => {
  if (place.kind === "theme") return { kind: "tailwind-theme", mode: undefined };
  if (place.kind === "root") return { kind: "css-variables", mode: undefined };
  if (place.kind === "mode") return { kind: "css-variables", mode: place.mode };
  return place.kind === "selector" && system.has(place.selector)
    ? { kind: "css-variables", mode: place.mode }
    : undefined;
};

/**
 * Whether a declaration is a token: not a framework's internals, a private variable or a way of clearing a namespace. A
 * name is plain and a value short, since both reach an agent's context as its next step, and a file may be written by
 * someone who wants that.
 */
const isTokenName = (name: string): boolean =>
  TOKEN_NAME.test(name) && !name.startsWith("--tw-") && !name.startsWith("--_");

/** Whether a value is short enough to be a value. */
const isTokenValue = (value: string): boolean => value !== "initial" && value.length <= LONGEST_TOKEN_VALUE;

/** The namespaces sheets clear (`--color-*: initial`), where Tailwind's defaults no longer apply. */
const clearedNamespaces = (sheets: readonly ReadSheet[]): readonly string[] =>
  sheets.flatMap(({ reading }) =>
    reading.declarations.flatMap(({ name, value }) =>
      value === "initial" && name.endsWith("*") ? [name.slice(0, -1)] : []
    )
  );

/** A sheet's declarations, in the shape tokens are made from. */
const sheetDeclarations = (dir: string, { file, reading }: ReadSheet): TokenDeclaration[] => {
  const system = systemSelectors(reading);
  const label = toPosix(relative(dir, file));
  return reading.declarations.flatMap(({ name, value, line, place }): TokenDeclaration[] => {
    const token = sheetToken(place, system);
    if (token === undefined || !isTokenName(name) || !isTokenValue(value)) return [];
    return [
      {
        name,
        value,
        mode: token.mode,
        origin: { kind: token.kind, file: label, line },
        ...(place.kind === "selector" ? { isScoped: true } : {})
      }
    ];
  });
};

/** Tailwind 4's default theme as declarations, when a sheet brings it in and it is installed. */
const themeDefaults = (
  sheets: readonly ReadSheet[],
  cleared: readonly string[],
  unread: string[]
): TokenDeclaration[] => {
  const importing = sheets.find(({ reading }) => reading.importsTailwindTheme);
  if (importing === undefined) return [];
  const file = packageFile(dirname(importing.file), "tailwindcss/theme.css");
  const text = file === undefined ? undefined : smallFileText(file);
  if (text === undefined) {
    unread.push("Tailwind's default theme: tailwindcss is not installed here");
    return [];
  }
  return readCssText(text).declarations.flatMap(({ name, value, line, place }): TokenDeclaration[] =>
    place.kind === "theme" &&
    isTokenName(name) &&
    isTokenValue(value) &&
    !cleared.some((prefix) => name.startsWith(prefix))
      ? [{ name, value, mode: undefined, origin: { kind: "tailwind-default", file: "tailwindcss", line } }]
      : []
  );
};

/** The spacing scale's steps as tokens: Tailwind makes them from one base, and classes write them. */
const spacingScale = (base: string, origin: TokenOrigin, declared: ReadonlySet<string>): TokenDeclaration[] =>
  SPACING_STEPS.flatMap((step): TokenDeclaration[] => {
    const name = `--spacing-${step}`;
    return declared.has(name)
      ? []
      : [{ name, value: `calc(${base} * ${step})`, mode: undefined, origin, type: "dimension" }];
  });

/** Tailwind's published palette, read as text from the installed package; none when it is not there. */
const installedPalette = (dir: string): readonly ConfigToken[] | undefined => {
  const installed = packageFile(dir, "tailwindcss/lib/public/colors.js");
  return installed === undefined ? undefined : readTailwindPalette(installed, smallFileText(installed) ?? "");
};

/** The colours a configuration takes from the palette by name: `brand: colors.blue` is a whole scale under `brand`. */
const paletteAliased = (
  aliases: readonly { readonly name: string; readonly palette: string }[],
  palette: readonly ConfigToken[],
  origin: TokenOrigin
): TokenDeclaration[] =>
  aliases.flatMap(({ name, palette: wanted }) =>
    palette.flatMap(({ name: named, value, type }): TokenDeclaration[] => {
      const full = `--color-${wanted}`;
      if (named !== full && !named.startsWith(`${full}-`)) return [];
      return [{ name: `${name}${named.slice(full.length)}`, value, mode: undefined, type, origin }];
    })
  );

/** Tailwind's default palette and scale as declarations, for a project on a configuration file (before version 4). */
const configDefaults = (
  dir: string,
  configs: readonly ReadConfig[],
  unread: string[]
): TokenDeclaration[] => {
  const replaced = new Set(configs.flatMap(({ reading }) => reading.replaced));
  const palette = installedPalette(dir);
  if (palette === undefined) {
    unread.push("Tailwind's default palette: tailwindcss is not installed here");
    return [];
  }
  const origin: TokenOrigin = { kind: "tailwind-default", file: "tailwindcss" };
  const colors = replaced.has("colors")
    ? []
    : palette.map(({ name, value, type }) => ({ name, value, mode: undefined, type, origin }));
  const scale = replaced.has("spacing") ? [] : spacingScale("0.25rem", origin, new Set());
  return [...colors, ...scale];
};

/** A configuration's tokens as declarations. */
const configDeclarations = (dir: string, { file, reading }: ReadConfig): TokenDeclaration[] => {
  const origin: TokenOrigin = { kind: "tailwind-config", file: toPosix(relative(dir, file)) };
  return [
    ...paletteAliased(reading.paletteAliases, installedPalette(dirname(file)) ?? [], origin),
    ...reading.tokens.map(({ name, value, type }) => ({ name, value, mode: undefined, type, origin }))
  ].filter(({ name, value }) => isTokenName(name) && isTokenValue(value));
};

/** What each authoring file declares, the lowest priority first. */
type Author = { readonly label: string; readonly declarations: readonly TokenDeclaration[] };

/** The clashes between files: each theme compared with itself. */
const clashesOf = (authors: readonly Author[]): TokenClash[] =>
  tokenClashes(
    authors.flatMap(({ label, declarations }) =>
      [...new Set(declarations.map((each) => each.mode))].map((mode) => ({
        mode,
        raw: declarations
          .filter((each) => each.mode === mode)
          .map(({ name, value }) => ({ name, value, label, source: label }))
      }))
    )
  );

/** What the tokens came from, each file once with how many it gave. */
const sourcesOf = (tokens: readonly DesignToken[]): TokenSource[] => {
  const counts = new Map<string, TokenSource>();
  for (const { origin } of tokens) {
    if (origin === undefined) continue;
    const key = `${origin.kind}\0${origin.file}`;
    const known = counts.get(key);
    counts.set(key, { kind: origin.kind, file: origin.file, tokens: (known?.tokens ?? 0) + 1 });
  }
  return [...counts.values()];
};

/** Tailwind's defaults for a project, whichever version it is on, and the spacing scale over its own declarations. */
const defaultDeclarations = (
  dir: string,
  sheets: readonly ReadSheet[],
  configs: readonly ReadConfig[],
  own: readonly TokenDeclaration[],
  unread: string[]
): TokenDeclaration[] => {
  const cleared = clearedNamespaces(sheets);
  const hasTheme = sheets.some(({ reading }) => reading.importsTailwindTheme);
  const isOnConfig = sheets.some(({ reading }) => reading.usesTailwindDirectives) || configs.length > 0;
  if (!hasTheme) {
    return isOnConfig ? configDefaults(dir, configs, unread) : [];
  }
  const defaults = themeDefaults(sheets, cleared, unread);
  const base = [...defaults, ...own].findLast((each) => each.name === "--spacing" && each.mode === undefined);
  const scale =
    base === undefined || cleared.includes("--spacing-")
      ? []
      : spacingScale(
          base.value,
          { kind: "tailwind-default", file: base.origin.file },
          new Set(own.map((each) => each.name))
        );
  return [...defaults, ...scale];
};

/**
 * Reads what an application declares of its design system.
 *
 * @param folder - the catalogue's folder.
 */
export const readAppTokens = (folder: string): AppTokens => {
  // a sheet's path comes back with its links followed, and the labels are relative to this
  const dir = realpathSync(folder);
  const unread: string[] = [];
  const shadcn = shadcnConfig(dir);
  const sheets = readSheets(dir, shadcn, unread);
  const configs = readConfigs(dir, shadcn, sheets, unread);
  for (const { file, reading } of configs) {
    unread.push(...reading.unread.map((each) => `${toPosix(relative(dir, file))}: ${each}`));
  }
  for (const plugin of new Set(sheets.flatMap(({ reading }) => reading.plugins))) {
    if (!KNOWN_PLUGIN.test(plugin))
      unread.push(`Tailwind plugin ${plugin}: what it adds to the theme is known only by running it`);
  }
  const authorOf = (file: string, declarations: readonly TokenDeclaration[]): Author => ({
    label: toPosix(relative(dir, file)),
    declarations
  });
  const fromSheets = sheets.map((sheet) => authorOf(sheet.file, sheetDeclarations(dir, sheet)));
  const named = shadcn?.css === undefined ? undefined : toPosix(relative(dir, shadcn.css));
  const authors = [
    ...fromSheets.filter(({ label }) => label !== named),
    ...configs.map((config) => authorOf(config.file, configDeclarations(dir, config))),
    ...fromSheets.filter(({ label }) => label === named)
  ];
  const declared = authors.flatMap(({ declarations }) => declarations);
  const onDocument = new Set(declared.filter((each) => each.isScoped !== true).map((each) => each.name));
  const own = declared.filter((each) => each.isScoped !== true || !onDocument.has(each.name));
  const lowest = defaultDeclarations(dir, sheets, configs, own, unread);
  const wrappers = colorWrappers([...sheets, ...configs].map(({ text }) => text));
  const tokens = resolvedTokens([...lowest, ...own], wrappers);
  const isDefault = (token: DesignToken): boolean => token.origin?.kind === "tailwind-default";
  const ordered = [...tokens.filter((token) => !isDefault(token)), ...tokens.filter(isDefault)];
  return {
    tokens: ordered,
    clashes: clashesOf(authors),
    sources: [
      ...(shadcn === undefined
        ? []
        : [{ kind: "components-json" as const, file: toPosix(relative(dir, shadcn.file)), tokens: 0 }]),
      ...sourcesOf(ordered)
    ],
    unread,
    files: [...sheets, ...configs].map(({ file }) => file).concat(shadcn === undefined ? [] : [shadcn.file])
  };
};
