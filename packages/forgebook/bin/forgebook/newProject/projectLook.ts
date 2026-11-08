/**
 * What makes a project's stories look and work as its app does, read from its files: the global style sheets a preview
 * must load, and, named as next steps, what cannot be worked out from outside (providers, portals, the head).
 *
 * @remarks
 * A catalogue runs no entry of the app, so what one does for the app does not happen for a story. A style sheet is the
 * one thing written for the project, because its import is the same one line everywhere; the others need code only the
 * project knows, so each is reported with where it was read and what to do. The app's build is another matter: the
 * catalogue reads it when it starts (`appBuild`), so nothing is asked of the project for its aliases, plugins or PostCSS.
 *
 * @module
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import ts from "typescript-6";

import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";
import type { ImportedFramework } from "../importers/storybookFrameworks.ts";
import type { NextStep } from "./newProject.types.ts";
import {
  angularProviders,
  angularStyles,
  bodyIds,
  isStyleSheet,
  markupWrappers,
  type PageFacts,
  pageFacts,
  styleSheetImports,
  vueInstalls
} from "./projectEntries.ts";
import { installedVersion } from "./projectPackages.ts";

/** What a project's files say about how its stories should look. */
export type ProjectLook = {
  /** The style sheets a preview loads, as its imports write them. */
  readonly styleSheets: readonly string[];
  /** What was left to do. */
  readonly nextSteps: readonly NextStep[];
};

/** The extensions an entry script may have. */
const ENTRY_EXTENSIONS = ["tsx", "ts", "jsx", "js", "mts", "mjs"];

/** The app's entries where its page names none, without their extension. */
const ENTRY_NAMES: Partial<Readonly<Record<ImportedFramework, readonly string[]>>> = {
  nextjs: ["app/layout", "src/app/layout", "pages/_app", "src/pages/_app"],
  "react-native-web": ["app/_layout", "src/app/_layout", "App", "src/App", "index"],
  angular: ["src/main", "src/app/app.config"]
};

/** A Vite project's usual entries, for one whose page cannot be read. */
const VITE_ENTRY_NAMES = ["src/main", "src/index"];

/** The page each framework starts from; Vite's `index.html` when not named. */
const PAGES: Partial<Readonly<Record<ImportedFramework, string | undefined>>> = {
  nextjs: undefined,
  nuxt: undefined,
  "react-native-web": undefined,
  sveltekit: "src/app.html",
  angular: "src/index.html"
};

/** The names a PostCSS configuration may have. */
const POSTCSS_FILES = [
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "postcss.config.ts",
  "postcss.config.mts",
  "postcss.config.cts",
  ".postcssrc",
  ".postcssrc.json",
  ".postcssrc.js",
  ".postcssrc.cjs",
  ".postcssrc.yaml",
  ".postcssrc.yml"
];

/** The largest file read, in bytes: an entry is small, and the readers need not meet a planted giant. */
const MAX_FILE_SIZE = 1_000_000;

/** A package specifier: a name, with its scope and a path inside it. */
const PACKAGE_SPECIFIER = /^(?:@[a-z0-9~-][\w.~-]*\/)?[a-z0-9~-][\w.~-]*(?:\/[\w.@~-]+)*$/;

/** Whether a path is a file. */
const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();

/** A file's text; empty past the size the readers take. */
const readText = (path: string): string =>
  statSync(path).size > MAX_FILE_SIZE ? "" : readFileSync(path, "utf8");

/**
 * Whether a file is really inside the project, links followed. A project's text decides what is read here and what a
 * preview imports, so it cannot be allowed to name a file elsewhere on the machine.
 */
const isInside = (projectDir: string, file: string): boolean => {
  const path = relative(realpathSync(projectDir), realpathSync(file));
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
};

/**
 * Whether the project has a PostCSS configuration of its own.
 *
 * @param projectDir - the project's folder.
 */
export const hasPostcssConfig = (projectDir: string): boolean =>
  POSTCSS_FILES.some((name) => isFile(join(projectDir, name)));

/** A path from the project's folder, as an import or a message writes it. */
const fromProject = (projectDir: string, file: string): string =>
  VITE_PATHS.normalize(relative(projectDir, file));

/** An alias a `tsconfig` declares, with the file that does. */
type TsconfigAlias = { readonly alias: string; readonly target: string; readonly file: string };

/** The aliases `tsconfig.json` and `tsconfig.app.json` declare (`@/*` to `./src/*`), which Vite's templates keep there. */
const tsconfigAliases = (projectDir: string): readonly TsconfigAlias[] =>
  ["tsconfig.json", "tsconfig.app.json"].flatMap((name) => {
    const file = join(projectDir, name);
    if (!isFile(file)) return [];
    const parsed: unknown = ts.parseConfigFileTextToJson(file, readText(file)).config;
    const options =
      typeof parsed === "object" && parsed !== null && "compilerOptions" in parsed
        ? parsed.compilerOptions
        : undefined;
    const paths =
      typeof options === "object" && options !== null && "paths" in options ? options.paths : undefined;
    if (typeof paths !== "object" || paths === null) return [];
    return Object.entries(paths).flatMap(([alias, targets]: [string, unknown]) => {
      const target: unknown = Array.isArray(targets) ? targets[0] : undefined;
      return typeof target === "string" ? [{ alias, target, file: name }] : [];
    });
  });

/** What a specifier is read against. */
type ImportScope = {
  /** The project's folder, absolute. */
  readonly projectDir: string;
  /** The project's aliases. */
  readonly aliases: readonly TsconfigAlias[];
  /** The packages it declares. */
  readonly declared: ReadonlyMap<string, string>;
};

/** A bare specifier if it names a package the project has: one it does not have would stop every story from loading. */
const packageImport = (specifier: string, { projectDir, declared }: ImportScope): string | undefined => {
  if (!PACKAGE_SPECIFIER.test(specifier) || specifier.split("/").includes("..")) return undefined;
  const parts = specifier.split("/");
  const name = parts.slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
  return declared.has(name) || installedVersion(projectDir, name) !== undefined ? specifier : undefined;
};

/**
 * A style sheet as a preview beside the configuration imports it, or none when it is not one, is outside the project, or
 * cannot be found from here: an import that does not load stops every story.
 *
 * @param specifier - the import or the page's address.
 * @param fromFile - the file that names it, absolute.
 * @param scope - what it is read against.
 */
const previewImport = (specifier: string, fromFile: string, scope: ImportScope): string | undefined => {
  const { projectDir, aliases } = scope;
  if (!isStyleSheet(specifier)) return undefined;
  const local = (file: string): string | undefined =>
    isFile(file) && isInside(projectDir, file) ? `./${fromProject(projectDir, file)}` : undefined;
  if (specifier.startsWith(".")) return local(resolve(dirname(fromFile), specifier));
  if (specifier.startsWith("/")) return local(join(projectDir, specifier));
  for (const { alias, target } of aliases) {
    const prefix = alias.replace(/\*$/, "");
    if (specifier.startsWith(prefix))
      return local(resolve(projectDir, target.replace(/\*$/, ""), specifier.slice(prefix.length)));
  }
  return packageImport(specifier, scope);
};

/** The entry scripts of a project: the ones its page starts, else the usual names. */
const entryFiles = (
  projectDir: string,
  framework: ImportedFramework,
  pageScripts: readonly string[]
): readonly string[] => {
  if (framework === "nuxt") return [];
  if (framework === "sveltekit")
    return ["src/routes/+layout.svelte", "src/routes/+layout@.svelte"]
      .map((name) => join(projectDir, name))
      .filter(isFile);
  const started = pageScripts
    .map((script) => join(projectDir, script.replace(/^\//, "")))
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && isFile(file) && isInside(projectDir, file));
  if (started.length > 0) return started;
  const names = ENTRY_NAMES[framework] ?? VITE_ENTRY_NAMES;
  return names.flatMap((name) => {
    const found = ENTRY_EXTENSIONS.map((extension) => join(projectDir, `${name}.${extension}`)).find(isFile);
    return found === undefined ? [] : [found];
  });
};

/** What a framework's entry says it wraps the app in. */
const wrappersIn = (framework: ImportedFramework, text: string): readonly string[] => {
  if (framework === "vue") return vueInstalls(text);
  if (framework === "angular") return angularProviders(text);
  if (framework === "web-components" || framework === "html" || framework === "nuxt") return [];
  return markupWrappers(text);
};

/** The sentence about a PostCSS configuration a catalogue cannot read: YAML, which would take a parser of its own. */
const buildSteps = (projectDir: string): readonly NextStep[] =>
  [".postcssrc.yaml", ".postcssrc.yml"]
    .filter((name) => isFile(join(projectDir, name)))
    .map((file) => ({
      kind: "postcss",
      file,
      message: `${file} is not run: the catalogue reads PostCSS's JSON and script files, so write it as postcss.config.mjs, or stories draw without what its plugins add`
    }));

/** Reads a JSON file; none for one that is not there or cannot be read. */
const readJsonFile = (file: string): unknown => {
  if (!isFile(file)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readText(file));
    return parsed;
  } catch {
    return undefined;
  }
};

/** A `styles` entry as an import: a file of the project's where there is one, else the package `ng add` names. */
const angularSpecifier = (projectDir: string, style: string): string => {
  const path = style.replace(/^\.\//, "");
  if (path.startsWith("node_modules/")) return path.slice("node_modules/".length);
  return isFile(join(projectDir, path)) ? `./${path}` : path;
};

/** An entry file, read. */
type EntryText = { readonly file: string; readonly text: string };

/** The style sheets named by a page, the entries and `angular.json`, each with the file that names it. */
const namedStyleSheets = (
  projectDir: string,
  framework: ImportedFramework,
  pageFile: string | undefined,
  facts: PageFacts | undefined,
  texts: readonly EntryText[]
): readonly { readonly specifier: string; readonly fromFile: string }[] => [
  ...(pageFile === undefined
    ? []
    : (facts?.styleSheets ?? []).map((href) => ({
        // an address in a page is relative to it, never a package's name
        specifier: /^[./]/.test(href) ? href : `./${href}`,
        fromFile: pageFile
      }))),
  ...texts.flatMap(({ file, text }) =>
    styleSheetImports(text).map((specifier) => ({ specifier, fromFile: file }))
  ),
  ...(framework === "angular"
    ? angularStyles(readJsonFile(join(projectDir, "angular.json"))).map((style) => ({
        specifier: angularSpecifier(projectDir, style),
        fromFile: join(projectDir, "angular.json")
      }))
    : [])
];

/** The next steps one entry file gives rise to. */
const entrySteps = (
  projectDir: string,
  framework: ImportedFramework,
  { file, text }: EntryText
): readonly NextStep[] => {
  const shown = fromProject(projectDir, file);
  const wrappers = wrappersIn(framework, text);
  return [
    ...(wrappers.length === 0
      ? []
      : [
          {
            kind: "provider" as const,
            file: shown,
            message: `${shown} sets up ${wrappers.join(", ")}: a component that needs one fails in a story until the preview gives it, in a decorator`
          }
        ]),
    ...(framework === "nextjs" && /from\s+["']next\/font\//.test(text)
      ? [
          {
            kind: "font" as const,
            file: shown,
            message: `${shown} sets its fonts with next/font on the page: stories show the fallback until a decorator in the preview applies their class`
          }
        ]
      : [])
  ];
};

/**
 * The next steps a page gives rise to: an element beside the app's root that the entry does not mount on is a portal's
 * or a widget's, and what its head loads from elsewhere stories do not get.
 */
const pageSteps = (
  page: string | undefined,
  framework: ImportedFramework,
  facts: PageFacts | undefined,
  texts: readonly EntryText[]
): readonly NextStep[] => {
  const entries = texts.map(({ text }) => text).join("\n");
  const ids =
    framework === "nextjs"
      ? texts.flatMap(({ text }) => bodyIds(text))
      : (facts?.bodyIds ?? []).filter((id) => !entries.includes(id));
  const links = facts?.remoteLinks ?? [];
  return [
    ...(ids.length === 0
      ? []
      : [
          {
            kind: "portal" as const,
            file: page,
            message: `The app's page holds ${ids.map((id) => `#${id}`).join(", ")}: a component that portals into one finds nothing in a story's frame until a decorator adds it`
          }
        ]),
    ...(links.length === 0
      ? []
      : [
          {
            kind: "head" as const,
            file: page,
            message: `${page ?? "The page"} links ${links.join(", ")}: give them to \`head\` in the configuration, or stories draw without them`
          }
        ])
  ];
};

/**
 * Reads what makes a project's stories look and work as its app does.
 *
 * @param projectDir - the project's folder, absolute.
 * @param framework - its framework.
 * @param declared - the packages it declares.
 */
export const readProjectLook = (
  projectDir: string,
  framework: ImportedFramework,
  declared: ReadonlyMap<string, string>
): ProjectLook => {
  const page = framework in PAGES ? PAGES[framework] : "index.html";
  const pageFile = page === undefined ? undefined : join(projectDir, page);
  const facts = pageFile !== undefined && isFile(pageFile) ? pageFacts(readText(pageFile)) : undefined;
  const texts = entryFiles(projectDir, framework, facts?.scripts ?? []).map((file) => ({
    file,
    text: readText(file)
  }));
  const scope = { projectDir, aliases: tsconfigAliases(projectDir), declared };
  const steps: NextStep[] = [];
  const styleSheets = new Set<string>();
  for (const { specifier, fromFile } of namedStyleSheets(projectDir, framework, pageFile, facts, texts)) {
    const found = previewImport(specifier, fromFile, scope);
    const shown = fromProject(projectDir, fromFile);
    if (found !== undefined) styleSheets.add(found);
    else
      steps.push({
        kind: "style-sheet",
        file: shown,
        message: `${shown} loads ${specifier}, which could not be read as a style sheet of this project or of a package it has: import it in the preview yourself if stories need it`
      });
  }
  return {
    styleSheets: [...styleSheets],
    nextSteps: [
      ...steps,
      ...texts.flatMap((entry) => entrySteps(projectDir, framework, entry)),
      ...pageSteps(page, framework, facts, texts),
      ...buildSteps(projectDir)
    ]
  };
};
