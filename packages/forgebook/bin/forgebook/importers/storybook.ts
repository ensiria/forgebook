/**
 * The Storybook importer of `forgebook init --from storybook`: what a project's `.storybook` folder says, turned into
 * what a Forgebook configuration needs (the story files, the preview, the switches).
 *
 * @remarks
 * `main` is loaded, as Storybook loads it (Node strips a `main.ts`'s types), so a `stories` list it computes is read
 * too. The preview is read from its source, never run: it imports style sheets and components Node cannot load, so its
 * `globalTypes` and `initialGlobals` are read only when written as plain values; anything else is named in the notes
 * instead. Forgebook reads React, Vue, Svelte, Preact, Solid, Web Components and plain HTML stories on Vite, a Nuxt
 * project's among them (`@storybook-vue/nuxt`, which Nuxt's Storybook module sets up), and a Next.js project's
 * (Storybook's `@storybook/nextjs`, on webpack, too: the stories are the same), so another framework is refused with
 * what Forgebook supports. A Svelte project's `.stories.svelte` files (Svelte CSF) are named in the
 * notes, since Forgebook reads CSF in scripts.
 * Each tool is an importer of its own: another tool is another module beside this one.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript-6";

import { switchesFromGlobalTypes, type ViewSwitch } from "../../../src/switches.ts";
import { STORY_FILE } from "../../../src/vite/autoTitle.ts";
import { VITE_PATHS, type VitePaths } from "../../../src/vite/vitePaths.ts";

/** The frameworks a project's stories can move to Forgebook with: `@forgebook/<name>`. */
export type ImportedFramework =
  | "react"
  | "vue"
  | "svelte"
  | "preact"
  | "solid"
  | "nextjs"
  | "web-components"
  | "html"
  | "nuxt";

/**
 * The function each framework's `@forgebook/<name>/vite` exports, which a configuration calls: the framework's name, or
 * its camel case where the name is no identifier.
 */
export const ADAPTER_FUNCTIONS: Readonly<Record<ImportedFramework, string>> = {
  react: "react",
  vue: "vue",
  svelte: "svelte",
  preact: "preact",
  solid: "solid",
  nextjs: "nextjs",
  "web-components": "webComponents",
  html: "html",
  nuxt: "nuxt"
};

/** What a configuration takes from another tool's files. */
export type ImportedConfig = {
  /** The Forgebook framework the stories are written for. */
  readonly framework: ImportedFramework;
  /** The framework's options, each a text (`{ dir: "web", nextConfig: "next.config.js" }`); none when there are none. */
  readonly frameworkOptions: Readonly<Record<string, string>> | undefined;
  /** The catalogue's name: the package's, or the folder's. */
  readonly title: string;
  /** The story files, as globs from the project's folder. */
  readonly stories: readonly string[];
  /** The preview's path from the project's folder; none when the tool has none. */
  readonly preview: string | undefined;
  /** The switches read from the preview's `globalTypes`; none leaves Forgebook's theme and contrast. */
  readonly switches: readonly ViewSwitch[] | undefined;
  /** What was not read, each a sentence for the person who runs the command. */
  readonly notes: readonly string[];
};

/** The Forgebook frameworks a project's Storybook can move to, by Storybook's framework. */
const STORYBOOK_FRAMEWORKS: Readonly<Record<string, ImportedFramework>> = {
  "@storybook/react-vite": "react",
  "@storybook/vue3-vite": "vue",
  "@storybook/svelte-vite": "svelte",
  "@storybook/sveltekit": "svelte",
  "@storybook/preact-vite": "preact",
  // Solid's Storybook framework is the community's, published under its own name
  "storybook-solidjs-vite": "solid",
  "@storybook/web-components-vite": "web-components",
  "@storybook/html-vite": "html",
  // Nuxt's Storybook module sets up a framework of its own, on Vue's
  "@storybook-vue/nuxt": "nuxt",
  "@storybook/nextjs-vite": "nextjs",
  "@storybook/nextjs": "nextjs"
};

/** What a Nuxt project's stories get differently once moved, said once the configuration is written. */
const NUXT_NOTES = [
  "Nuxt's modules and plugins are not run: a component that needs what one provides (a store, i18n) gets it from a decorator",
  "A story's route, data, state and cookies are set with parameters.nuxt (route, data, state, cookies), not by a decorator that drives the router"
] as const;

/** Storybook's own default for a `stories` entry given as a folder. */
const DEFAULT_FILES = "**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))";

/** The names `main` and the preview may have, in the order Storybook looks for them. */
const SCRIPT_EXTENSIONS = ["ts", "mts", "tsx", "js", "mjs", "cjs", "jsx"];

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The first file of a name that exists in a folder, whatever its script extension.
 *
 * @param dir - the folder.
 * @param name - the file's name without its extension (`main`).
 */
const scriptFile = (dir: string, name: string): string | undefined =>
  SCRIPT_EXTENSIONS.map((extension) => join(dir, `${name}.${extension}`)).find((file) => existsSync(file));

/**
 * Every glob a glob with alternatives stands for: `@(a|b)` and `{a,b}` written out, nested ones too, so the
 * configuration lists plain globs a person reads at a glance.
 *
 * @param glob - the glob.
 */
export const expandedGlobs = (glob: string): string[] => {
  const start = glob.search(/@\(|\{/);
  if (start === -1) return [glob];
  const isExtglob = glob[start] === "@";
  const separator = isExtglob ? "|" : ",";
  const contentStart = start + (isExtglob ? 2 : 1);
  // every bracket counts, so a group nested in another of the other kind is kept whole
  let depth = 1;
  let partStart = contentStart;
  const parts: string[] = [];
  for (let index = contentStart; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === "(" || character === "{") depth += 1;
    else if (character === ")" || character === "}") depth -= 1;
    if (depth === 1 && character === separator) {
      parts.push(glob.slice(partStart, index));
      partStart = index + 1;
    } else if (depth === 0) {
      parts.push(glob.slice(partStart, index));
      const head = glob.slice(0, start);
      const tail = glob.slice(index + 1);
      return parts.flatMap((part) => expandedGlobs(`${head}${part}${tail}`));
    }
  }
  return [glob];
};

/**
 * One `stories` entry as a glob from the project's folder: a glob as it is, a folder with its files.
 *
 * @param entry - the entry.
 * @param fromProject - a path from the `.storybook` folder, made a path from the project's.
 * @param notes - where what is not read is named.
 * @returns the glob, or none for an entry that is neither.
 */
const entryGlob = (
  entry: unknown,
  fromProject: (path: string) => string,
  notes: string[]
): string | undefined => {
  if (typeof entry === "string") return fromProject(entry);
  if (!isRecord(entry) || typeof entry["directory"] !== "string") {
    notes.push(`A stories entry that is neither a glob nor a folder was left out: ${JSON.stringify(entry)}`);
    return undefined;
  }
  if (typeof entry["titlePrefix"] === "string")
    notes.push(`${entry["directory"]}: its titlePrefix "${entry["titlePrefix"]}" is not read`);
  const files = typeof entry["files"] === "string" ? entry["files"] : DEFAULT_FILES;
  return `${fromProject(entry["directory"])}/${files}`;
};

/**
 * The story globs of Storybook's `stories`, from the project's folder: each entry a glob from the `.storybook` folder or
 * a folder with its files, its alternatives written out, the documentation pages (`.mdx`) left out.
 *
 * @param entries - `main`'s `stories`.
 * @param storybookDir - the `.storybook` folder, absolute.
 * @param projectDir - the project's folder, absolute.
 * @param paths - the path functions; the running system's unless a test names another.
 * @returns the globs, with forward slashes on every system as globs take them, and what was not read.
 */
export const storyGlobs = (
  entries: readonly unknown[],
  storybookDir: string,
  projectDir: string,
  paths: VitePaths = VITE_PATHS
): { readonly globs: string[]; readonly notes: string[] } => {
  const globs: string[] = [];
  const notes: string[] = [];
  const fromProject = (path: string): string =>
    paths.relative(projectDir, paths.resolve(storybookDir, path)) || ".";
  for (const entry of entries) {
    const glob = entryGlob(entry, fromProject, notes);
    if (glob === undefined) continue;
    // `.stories.*` names every script extension: written out as the ones Forgebook reads
    const named = glob.replace(/\.stories\.\*$/, ".stories.@(js|jsx|mjs|ts|tsx)");
    for (const each of expandedGlobs(named)) {
      if (STORY_FILE.test(each)) globs.push(each);
      else if (!each.endsWith(".mdx")) notes.push(`${each}: not a story file Forgebook reads`);
    }
  }
  if (entries.some((entry) => typeof entry === "string" && entry.includes(".mdx")))
    notes.push("The MDX pages are left out: Forgebook reads story files, not MDX");
  return { globs: [...new Set(globs)], notes };
};

/** A value that cannot be read without running the file. */
const NOT_PLAIN: unique symbol = Symbol("not plain");

/** An expression without the `as`, `satisfies` and parentheses around it. */
const unwrapped = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

/**
 * A plain value written in source (texts, numbers, booleans, `null`, lists and objects of them), or `NOT_PLAIN`.
 *
 * @param expression - the expression.
 */
const plainValue = (expression: ts.Expression): unknown => {
  const node = unwrapped(expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    const items = node.elements.map(plainValue);
    return items.includes(NOT_PLAIN) ? NOT_PLAIN : items;
  }
  return ts.isObjectLiteralExpression(node) ? plainObject(node) : NOT_PLAIN;
};

/**
 * An object literal's plain value: each property a name and a plain value, or `NOT_PLAIN`.
 *
 * @param node - the object literal.
 */
const plainObject = (node: ts.ObjectLiteralExpression): unknown => {
  const entries: [string, unknown][] = [];
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) return NOT_PLAIN;
    const { name } = property;
    if (!(ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))) return NOT_PLAIN;
    const value = plainValue(property.initializer);
    if (value === NOT_PLAIN) return NOT_PLAIN;
    entries.push([name.text, value]);
  }
  return Object.fromEntries(entries);
};

/**
 * A top-level constant's declaration, by name.
 *
 * @param source - the file, parsed.
 * @param name - the constant's name.
 * @param isExported - whether only an exported one counts.
 */
const constantDeclaration = (
  source: ts.SourceFile,
  name: string,
  isExported = false
): ts.VariableDeclaration | undefined => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (isExported && !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
      continue;
    const declaration = statement.declarationList.declarations.find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name
    );
    if (declaration !== undefined) return declaration;
  }
  return undefined;
};

/**
 * The preview's default export as an object literal: written in the export, or in the constant it exports.
 *
 * @param source - the preview, parsed.
 */
const previewObject = (source: ts.SourceFile): ts.ObjectLiteralExpression | undefined => {
  const exported = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals
  );
  if (exported === undefined) return undefined;
  const expression = unwrapped(exported.expression);
  if (ts.isObjectLiteralExpression(expression)) return expression;
  if (!ts.isIdentifier(expression)) return undefined;
  const initializer = constantDeclaration(source, expression.text)?.initializer;
  const value = initializer === undefined ? undefined : unwrapped(initializer);
  return value !== undefined && ts.isObjectLiteralExpression(value) ? value : undefined;
};

/**
 * A field of the preview: a property of its default export, or a named export (`export const globalTypes = …`).
 *
 * @param source - the preview, parsed.
 * @param name - the field.
 */
const previewField = (source: ts.SourceFile, name: string): ts.Expression | undefined => {
  const property = previewObject(source)?.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      (ts.isIdentifier(candidate.name) || ts.isStringLiteral(candidate.name)) &&
      candidate.name.text === name
  );
  return property?.initializer ?? constantDeclaration(source, name, true)?.initializer;
};

/**
 * The switches a preview's `globalTypes` give, read from its source.
 *
 * @param text - the preview's source.
 * @param file - its path, for the parser and the notes.
 * @returns the switches (none when it declares no toolbar of its own), and what was not read.
 */
export const previewSwitches = (
  text: string,
  file: string
): { readonly switches: ViewSwitch[] | undefined; readonly notes: string[] } => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const globalTypes = previewField(source, "globalTypes");
  if (globalTypes === undefined) return { switches: undefined, notes: [] };
  const types = plainValue(globalTypes);
  if (!isRecord(types))
    return {
      switches: undefined,
      notes: [`${basename(file)}: its globalTypes are not plain values, so no switch was made from them`]
    };
  const initialField = previewField(source, "initialGlobals");
  const initial = initialField === undefined ? undefined : plainValue(initialField);
  const notes =
    initialField !== undefined && !isRecord(initial)
      ? [
          `${basename(file)}: its initialGlobals are not plain values, so each switch starts at its first value`
        ]
      : [];
  const switches = switchesFromGlobalTypes(types, isRecord(initial) ? { initialGlobals: initial } : {});
  return { switches: switches.length === 0 ? undefined : switches, notes };
};

/**
 * The project's name: its package's, or its folder's.
 *
 * @param dir - the project's folder.
 */
const projectTitle = (dir: string): string => {
  const file = join(dir, "package.json");
  if (existsSync(file)) {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (isRecord(parsed) && typeof parsed["name"] === "string" && parsed["name"] !== "")
      return parsed["name"];
  }
  return basename(dir);
};

/**
 * The framework `main` names: a text, or an object with its `name` and its `options`.
 *
 * @param main - `main`'s configuration.
 */
const frameworkOf = (
  main: Readonly<Record<string, unknown>>
): { readonly name: string | undefined; readonly options: Readonly<Record<string, unknown>> } => {
  const { framework } = main;
  if (typeof framework === "string") return { name: framework, options: {} };
  if (!isRecord(framework)) return { name: undefined, options: {} };
  return {
    name: typeof framework["name"] === "string" ? framework["name"] : undefined,
    options: isRecord(framework["options"]) ? framework["options"] : {}
  };
};

/**
 * Storybook's `main`, loaded as Node loads a module.
 *
 * @param mainFile - its file.
 * @param projectDir - the project's folder, for the messages.
 * @returns its configuration, or why it cannot be had.
 */
const loadedMain = async (
  mainFile: string,
  projectDir: string
): Promise<Readonly<Record<string, unknown>> | string> => {
  let loaded: unknown;
  try {
    loaded = await import(pathToFileURL(mainFile).href);
  } catch (error) {
    // Storybook loads main with a loader of its own (require works there); Node loads it as the module it is
    const reason = error instanceof Error ? error.message : String(error);
    return `${relative(projectDir, mainFile)} could not be loaded as Node loads a module (${reason}); Storybook loads it with a loader of its own, so a require() or a path helper in it may need an import instead`;
  }
  const main = isRecord(loaded) && isRecord(loaded["default"]) ? loaded["default"] : loaded;
  return isRecord(main) ? main : `${relative(projectDir, mainFile)} exports no configuration`;
};

/**
 * The Storybook framework `main` names, by its package: its name, or a path to its package, as Storybook's monorepo
 * template writes it (`getAbsolutePath("@storybook/react-vite")`).
 *
 * @param framework - the framework's name or path.
 * @returns the package, or none for one Forgebook does not read.
 */
const storybookFramework = (framework: string | undefined): string | undefined => {
  if (framework === undefined) return undefined;
  const path = VITE_PATHS.normalize(framework).replace(/\/$/, "");
  return Object.keys(STORYBOOK_FRAMEWORKS).find((name) => path === name || path.endsWith(`/${name}`));
};

/**
 * What a Next.js project's Storybook says that the Next.js framework reads: its `next.config` when not where Next.js
 * looks, and what Forgebook does without being told.
 *
 * @param main - `main`'s configuration.
 * @param storybook - Storybook's framework package.
 * @param projectDir - the project's folder.
 * @returns the framework's options, and the notes.
 */
const nextjsSettings = (
  main: Readonly<Record<string, unknown>>,
  storybook: string,
  projectDir: string
): { readonly options: Readonly<Record<string, string>> | undefined; readonly notes: string[] } => {
  const notes: string[] = [];
  if (storybook === "@storybook/nextjs")
    notes.push(
      "Storybook's Next.js framework on webpack: Forgebook runs on Vite, so webpackFinal and a Babel configuration are not read"
    );
  const features = main["features"];
  if (isRecord(features) && features["experimentalRSC"] === true)
    notes.push("experimentalRSC is not needed: Forgebook draws async server components without a flag");
  const { nextConfigPath } = frameworkOf(main).options;
  // the Next.js app's folder is where its next.config is: its tsconfig, .env files and PostCSS are there too
  const file =
    typeof nextConfigPath === "string" ? VITE_PATHS.resolve(projectDir, nextConfigPath) : undefined;
  const appDir = file === undefined ? "" : VITE_PATHS.relative(projectDir, VITE_PATHS.dirname(file));
  const options =
    file === undefined
      ? undefined
      : { ...(appDir === "" ? {} : { dir: appDir }), nextConfig: basename(file) };
  return { options, notes };
};

/**
 * Reads a project's Storybook configuration.
 *
 * @param projectDir - the project's folder, absolute.
 * @returns what a Forgebook configuration takes from it, or why it cannot be read.
 */
export const importStorybook = async (projectDir: string): Promise<ImportedConfig | string> => {
  const storybookDir = join(projectDir, ".storybook");
  const mainFile = scriptFile(storybookDir, "main");
  if (mainFile === undefined) return `No .storybook/main file in ${projectDir}`;
  const main = await loadedMain(mainFile, projectDir);
  if (typeof main === "string") return main;
  const storybook = storybookFramework(frameworkOf(main).name);
  if (storybook === undefined) {
    const supported = Object.keys(STORYBOOK_FRAMEWORKS).join(", ");
    return `Forgebook reads the stories of Storybook's ${supported}; this project uses ${frameworkOf(main).name ?? "no framework"}`;
  }
  const framework = STORYBOOK_FRAMEWORKS[storybook] ?? "react";
  const nextjs =
    framework === "nextjs" ? nextjsSettings(main, storybook, projectDir) : { options: undefined, notes: [] };
  const entries = Array.isArray(main["stories"]) ? main["stories"] : [];
  const { globs, notes } = storyGlobs(entries, storybookDir, projectDir);
  if (globs.length === 0) return `${relative(projectDir, mainFile)} names no story file Forgebook reads`;
  if (storybook === "@storybook/sveltekit")
    notes.push(
      "SvelteKit's $app modules and $lib alias are not provided: a story that imports them needs an alias of its own"
    );
  if (Array.isArray(main["addons"]) && main["addons"].length > 0)
    notes.push("The addons are left out: Forgebook has its own panel, toolbar and checks");
  if (framework === "nuxt") notes.push(...NUXT_NOTES);
  notes.push(...nextjs.notes);
  const previewFile = scriptFile(storybookDir, "preview");
  const read =
    previewFile === undefined
      ? { switches: undefined, notes: [] }
      : previewSwitches(readFileSync(previewFile, "utf8"), previewFile);
  return {
    framework,
    frameworkOptions: nextjs.options,
    title: projectTitle(projectDir),
    stories: globs,
    // with forward slashes: it is written into the configuration, which may be shared across systems
    preview: previewFile === undefined ? undefined : VITE_PATHS.relative(projectDir, previewFile),
    switches: read.switches,
    notes: [...notes, ...read.notes]
  };
};
