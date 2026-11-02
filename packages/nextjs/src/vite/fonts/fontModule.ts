/**
 * The module a call of `next/font` becomes: a style sheet with the font's faces and its classes, written beside the
 * catalogue's cache, and the object Next.js's call returns (`{ className, style, variable }`).
 *
 * @remarks
 * The style sheet is a file, so Vite treats it as any other: it serves and bundles the font files its `url()` names,
 * relative to it, a project's local fonts and the Google fonts downloaded beside it alike. A font that cannot be had
 * (a call with wrong options, Google out of reach) still gives its classes, with the family and its fallbacks: the
 * story draws in a fallback font instead of failing, and a warning says why.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import type { GoogleFontsMode } from "../nextjs.ts";
import type { FontCall } from "./fontCalls.ts";
import {
  DISPLAYS,
  type Fetcher,
  fetchGoogleCss,
  googleFamily,
  googleFontFiles,
  googleFontRequest,
  selfHostedCss
} from "./googleFonts.ts";

/** What building a font's module needs. */
export type FontModuleContext = {
  /** The folder the style sheets and the downloaded fonts are written to. */
  readonly cacheDir: string;
  /** Next.js's list of Google's families, as its file parsed; none when the project's `next` has none. */
  readonly googleData: unknown;
  /** How Google fonts are had. */
  readonly googleFonts: GoogleFontsMode;
  /** Fetches an address. */
  readonly fetcher: Fetcher;
  /** Says what could not be done, once per font. */
  readonly warn: (message: string) => void;
};

/** The generic families CSS knows, written without quotes. */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong"
]);

/** The formats of font files, by extension, as `@font-face` names them. */
const FONT_FORMATS: Readonly<Record<string, string>> = {
  ".woff2": "woff2",
  ".woff": "woff",
  ".ttf": "truetype",
  ".otf": "opentype",
  ".eot": "embedded-opentype"
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What each option written into a style sheet may hold, as Next.js checks it: nothing that leaves its declaration. */
const SAFE_VALUES: Readonly<Record<string, RegExp>> = {
  variable: /^--[\w-]+$/,
  weight: /^(\d{1,4}( \d{1,4})?|normal|bold|variable)$/,
  style: /^(normal|italic|oblique)$/,
  fallback: /^[\w -]+$/
};

/**
 * Whether a text is one an option may hold.
 *
 * @param name - the option.
 * @param value - the text.
 */
const isSafe = (name: string, value: unknown): boolean => {
  if (typeof value !== "string") return false;
  if (name === "display") return DISPLAYS.includes(value);
  return SAFE_VALUES[name]?.test(value) ?? true;
};

/**
 * A call's options with every value checked before it is written into a style sheet: one that is not what Next.js
 * accepts is left out, with a warning.
 *
 * @param options - the call's options.
 * @param warn - says what was left out.
 */
const checkedOptions = (
  options: Readonly<Record<string, unknown>>,
  warn: (message: string) => void
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(options).flatMap(([name, value]) => {
      if (!["variable", "weight", "style", "fallback", "display"].includes(name)) return [[name, value]];
      const values = Array.isArray(value) ? value : [value];
      if (values.every((each) => isSafe(name, each))) return [[name, value]];
      warn(`next/font: ${name} ${JSON.stringify(value)} is not a value Next.js accepts, so it is left out`);
      return [];
    })
  );

/**
 * A short hash of a text, for file and class names.
 *
 * @param text - the text.
 */
export const shortHash = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 8);

/**
 * A family written for `font-family`: quoted, unless it is a generic one.
 *
 * @param family - the family.
 */
const familyText = (family: string): string =>
  GENERIC_FAMILIES.has(family) ? family : `'${family.replaceAll("'", "\\'")}'`;

/**
 * The texts of an option: one text, or a list of them.
 *
 * @param value - the option.
 */
const texts = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
};

/**
 * A path written for a style sheet's `url()`: from the style sheet's folder, with forward slashes.
 *
 * @param from - the style sheet's folder.
 * @param file - the file.
 */
const urlPath = (from: string, file: string): string => {
  const path = relative(from, file).split("\\").join("/");
  return path.startsWith(".") ? path : `./${path}`;
};

/**
 * A local font's files, as its `src` lists them: one path, or a list of objects with their own weight and style.
 *
 * @param src - the call's `src`.
 */
const localSources = (src: unknown): Readonly<Record<string, unknown>>[] => {
  if (typeof src === "string") return [{ path: src }];
  return Array.isArray(src) ? src.filter(isRecord) : [];
};

/**
 * The declarations a local font adds to each face (`declarations: [{ prop, value }]`).
 *
 * @param declarations - the call's `declarations`.
 */
const extraDeclarations = (declarations: unknown): string[] =>
  Array.isArray(declarations)
    ? declarations.flatMap((declaration: unknown) =>
        isRecord(declaration) &&
        typeof declaration["prop"] === "string" &&
        typeof declaration["value"] === "string"
          ? [`  ${declaration["prop"]}: ${declaration["value"]};`]
          : []
      )
    : [];

/**
 * One face of a local font.
 *
 * @param file - its file.
 * @param family - the family the faces declare.
 * @param cacheDir - the folder the style sheet is written to.
 * @param settings - its display, weight, style and extra declarations.
 */
const localFace = (
  file: string,
  family: string,
  cacheDir: string,
  settings: {
    readonly display: string;
    readonly weight: unknown;
    readonly style: unknown;
    readonly declarations: readonly string[];
  }
): string => {
  const format = FONT_FORMATS[extname(file).toLowerCase()];
  return [
    "@font-face {",
    `  font-family: ${familyText(family)};`,
    `  src: url(${JSON.stringify(urlPath(cacheDir, file))})${format === undefined ? "" : ` format("${format}")`};`,
    `  font-display: ${settings.display};`,
    ...(typeof settings.weight === "string" ? [`  font-weight: ${settings.weight};`] : []),
    ...(typeof settings.style === "string" ? [`  font-style: ${settings.style};`] : []),
    ...settings.declarations,
    "}"
  ].join("\n");
};

/**
 * A local font's faces: one per file of its `src`, each with its weight and style.
 *
 * @param call - the call.
 * @param importer - the module that made it.
 * @param family - the family the faces declare.
 * @param cacheDir - the folder the style sheet is written to.
 * @returns the faces, and the files they read.
 */
const localFaces = (
  call: FontCall,
  importer: string,
  family: string,
  cacheDir: string
): { readonly css: string; readonly files: readonly string[] } | string => {
  const sources = localSources(call.options["src"]);
  if (sources.length === 0) return "localFont(…): give its `src`, a file or a list of files";
  const display = typeof call.options["display"] === "string" ? call.options["display"] : "swap";
  const declarations = extraDeclarations(call.options["declarations"]);
  const files: string[] = [];
  const faces: string[] = [];
  for (const source of sources) {
    if (typeof source["path"] !== "string") return "localFont(…): each `src` needs its `path`";
    const file = resolve(dirname(importer), source["path"]);
    if (!existsSync(file)) return `localFont(…): ${source["path"]} is not there (from ${importer})`;
    files.push(file);
    const weight = isSafe("weight", source["weight"]) ? source["weight"] : call.options["weight"];
    const style = isSafe("style", source["style"]) ? source["style"] : call.options["style"];
    faces.push(localFace(file, family, cacheDir, { display, weight, style, declarations }));
  }
  return { css: faces.join("\n"), files };
};

/**
 * A Google font's faces: its style sheet, from the cache or from Google, its files downloaded beside it.
 *
 * @param url - the style sheet's address.
 * @param context - the cache, the fetcher and the warnings.
 * @returns the faces, or why they could not be had.
 */
const googleFaces = async (url: string, context: FontModuleContext): Promise<string | Error> => {
  const sheetFile = join(context.cacheDir, `google-${shortHash(url)}.css`);
  if (existsSync(sheetFile)) return readFileSync(sheetFile, "utf8");
  const css = await fetchGoogleCss(url, context.fetcher);
  if (css instanceof Error) return css;
  const saved = new Map<string, string>();
  await Promise.all(
    googleFontFiles(css).map(async (fontUrl) => {
      const name = `google-${shortHash(fontUrl)}${extname(new URL(fontUrl).pathname) || ".woff2"}`;
      try {
        const response = await context.fetcher(fontUrl, { headers: {}, redirect: "error" });
        if (!response.ok) return;
        writeFileSync(join(context.cacheDir, name), new Uint8Array(await response.arrayBuffer()));
        saved.set(fontUrl, `./${name}`);
      } catch {
        // the style sheet keeps Google's address for this file
      }
    })
  );
  const hosted = selfHostedCss(css, saved);
  // a style sheet whose files did not all download is not kept: the next start tries again
  if (saved.size === googleFontFiles(css).length) writeFileSync(sheetFile, hosted);
  return hosted;
};

/**
 * The classes Next.js's call gives: the class that sets the family (with its weight and style when only one), and the
 * class that sets the CSS variable when the call names one.
 *
 * @param stack - the family and its fallbacks, as `font-family` takes them.
 * @param hash - the call's hash.
 * @param options - the call's options.
 * @param weight - the one weight asked for, if only one.
 * @param style - the one style asked for, if only one.
 */
const classes = (
  stack: string,
  hash: string,
  options: Readonly<Record<string, unknown>>,
  weight: string | undefined,
  style: string | undefined
): { readonly css: string; readonly value: Readonly<Record<string, unknown>> } => {
  const className = `__className_${hash}`;
  const variable = typeof options["variable"] === "string" ? options["variable"] : undefined;
  const variableClass = `__variable_${hash}`;
  const css = [
    `.${className} {`,
    `  font-family: ${stack};`,
    ...(weight === undefined ? [] : [`  font-weight: ${weight};`]),
    ...(style === undefined ? [] : [`  font-style: ${style};`]),
    "}",
    ...(variable === undefined ? [] : [`.${variableClass} {`, `  ${variable}: ${stack};`, "}"])
  ].join("\n");
  const value = {
    className,
    style: {
      fontFamily: stack,
      ...(weight === undefined ? {} : { fontWeight: Number(weight) }),
      ...(style === undefined ? {} : { fontStyle: style })
    },
    ...(variable === undefined ? {} : { variable: variableClass })
  };
  return { css, value };
};

/** A font's module: its JavaScript, and the files whose change renews it. */
export type BuiltFontModule = {
  /** The module's code: the style sheet's import and the call's value. */
  readonly code: string;
  /** The project's font files it reads. */
  readonly watch: readonly string[];
};

/** What a font gives its style sheet and its classes. */
type FontParts = {
  /** The family its faces declare. */
  readonly family: string;
  /** Its faces, or nothing when they could not be had. */
  readonly faces: string;
  /** The project's font files it reads. */
  readonly watch: readonly string[];
  /** The one weight asked for, if only one. */
  readonly weight: string | undefined;
  /** The one style asked for, if only one. */
  readonly style: string | undefined;
};

/**
 * The only value of a list, or none when it has another number of values.
 *
 * @param values - the list.
 */
const onlyValue = (values: readonly string[]): string | undefined =>
  values.length === 1 ? values[0] : undefined;

/**
 * A local font's parts.
 *
 * @param call - the call.
 * @param importer - the module that made it.
 * @param hash - the call's hash.
 * @param context - the cache and the warnings.
 */
const localFont = (call: FontCall, importer: string, hash: string, context: FontModuleContext): FontParts => {
  const family = `__${call.variable ?? "localFont"}_${hash}`;
  const read = localFaces(call, importer, family, context.cacheDir);
  if (typeof read === "string") context.warn(read);
  const weight = onlyValue(texts(call.options["weight"]));
  return {
    family,
    faces: typeof read === "string" ? "" : read.css,
    watch: typeof read === "string" ? [] : read.files,
    // a range (`"100 900"`) is a variable font's: no single weight for the class
    weight: weight?.includes(" ") === true ? undefined : weight,
    style: onlyValue(texts(call.options["style"]))
  };
};

/**
 * A Google font's parts.
 *
 * @param family - the family.
 * @param call - the call.
 * @param context - the cache, the fonts' data, the fetcher and the warnings.
 */
const googleFont = async (family: string, call: FontCall, context: FontModuleContext): Promise<FontParts> => {
  const data = googleFamily(context.googleData, family);
  const request =
    data === undefined
      ? `${family} is not in Next.js's list of Google fonts`
      : googleFontRequest(family, call.options, data);
  const none = { family, faces: "", watch: [], weight: undefined, style: undefined };
  if (typeof request === "string") {
    context.warn(request);
    return none;
  }
  const weight = onlyValue(request.weights);
  const parts = {
    ...none,
    weight: weight === "variable" ? undefined : weight,
    style: onlyValue(request.styles)
  };
  if (context.googleFonts === "none") return parts;
  const faces = await googleFaces(request.url, context);
  if (typeof faces === "string") return { ...parts, faces };
  context.warn(`${family} could not be had from Google Fonts, so its fallback shows: ${faces.message}`);
  return parts;
};

/**
 * The module a call of `next/font` becomes.
 *
 * @param call - the call.
 * @param importer - the module that made it.
 * @param context - the cache, the fonts' data, the fetcher and the warnings.
 */
export const buildFontModule = async (
  call: FontCall,
  importer: string,
  context: FontModuleContext
): Promise<BuiltFontModule> => {
  const options = checkedOptions(call.options, context.warn);
  // a local font's files are its importer's: the same call in two folders is two fonts
  const hash = shortHash(
    JSON.stringify([call.loader, call.family, options, call.loader === "local" ? importer : ""])
  );
  const checked = { ...call, options };
  mkdirSync(context.cacheDir, { recursive: true });
  const parts =
    checked.loader === "local" || checked.family === undefined
      ? localFont(checked, importer, hash, context)
      : await googleFont(checked.family, checked, context);
  const stack = [familyText(parts.family), ...texts(options["fallback"]).map(familyText)].join(", ");
  const built = classes(stack, hash, options, parts.weight, parts.style);
  const sheet = join(context.cacheDir, `${hash}.css`);
  writeFileSync(sheet, `${parts.faces}\n${built.css}\n`);
  return {
    code: `import ${JSON.stringify(sheet.split("\\").join("/"))};\nexport default ${JSON.stringify(built.value)};\n`,
    watch: parts.watch
  };
};
