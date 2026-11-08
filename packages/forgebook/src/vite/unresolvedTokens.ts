/**
 * The tokens of an application's sheets that a browser gives no value, as problems: a reference that leads back to
 * itself, or one to a name nothing declares.
 *
 * @remarks
 * A token that resolves to nothing draws the UI with no colour or no size, and nothing else says so: the browser drops the
 * declaration in silence. A cycle in the base is always a problem. A name the sheets do not declare may still get a value:
 * another rule declares it, `@property` registers it, an installed package's sheet does, or code sets it (`next/font`
 * writes `--font-geist-sans` on the page's element). So the names every sheet read declares count, those of the packages
 * the sheets import count, and so does a name the repository's files write as code sets one: in quotes, as a declaration
 * (`--gap:` in a template, a `.vue` style block, a sheet not read), a Svelte `style:` directive, a Tailwind arbitrary
 * property. When that cannot all be known (a package's sheet that cannot be read, a sheet that builds names with Sass or
 * Less, the files that cannot be searched), or when a cycle exists only inside a theme, which depends on the element the
 * theme is set on, the line is something not read, which fails nothing, and never a problem that might be false. The
 * repository is searched only for names already found missing, so an answer with none reads nothing more.
 *
 * @module
 */
import { spawnSync } from "node:child_process";

import { importedPackageSheets, type ReadConfig, type ReadSheet, repositoryOf } from "./appTokenFiles.ts";
import { type CssReading, readCssText } from "./cssDeclarations.ts";
import { type BrokenReference, brokenReferences } from "./cssReferences.ts";
import type { TokenDeclaration } from "./cssTokenValues.ts";

/** What the check found. */
export type UnresolvedTokens = {
  /** Tokens with no value, one line each with its file and line. */
  readonly problems: readonly string[];
  /** Tokens that may have no value, where what declares the name could not all be read. */
  readonly unread: readonly string[];
};

/** The files a custom property is set in, by code or by a sheet this does not read as the application's system. */
const SEARCHED_FILES = [
  "*.js",
  "*.jsx",
  "*.mjs",
  "*.cjs",
  "*.ts",
  "*.tsx",
  "*.mts",
  "*.cts",
  "*.vue",
  "*.svelte",
  "*.astro",
  "*.html",
  "*.css",
  "*.scss",
  "*.sass",
  "*.less",
  "*.pcss",
  "*.postcss"
];

/** How long git may take to search the repository, in milliseconds. */
const SEARCH_TIMEOUT = 10_000;

/** How many names a line gives, of a cycle or of tokens that could not be told: past a few, they say nothing more. */
const MOST_NAMED = 5;

/** A name built by Sass or Less interpolation (`--#{$key}`, `--@{key}`), which no reading of the text can know. */
const BUILT_NAME = /--(?:#\{|@\{)/;

/** A custom property `@property` registers: it has its initial value wherever nothing else sets it. */
const REGISTERED = /@property\s+(--[\w-]+)/g;

/**
 * The names of custom properties sheets declare. A cleared one (`initial`) gives no value, and one that only reads its own
 * name (Tailwind's `@theme inline { --font-sans: var(--font-sans); }`) takes its value from elsewhere.
 */
const declaredNames = (readings: readonly CssReading[], texts: readonly string[]): Set<string> => {
  const declared = new Set(
    readings.flatMap(({ declarations }) =>
      declarations.flatMap(({ name, value }) => (isOwnReference(name, value) ? [] : [name]))
    )
  );
  for (const text of texts) for (const [, name = ""] of text.matchAll(REGISTERED)) declared.add(name);
  return declared;
};

/** Whether a value gives no value of its own: cleared, or reading only its own name. */
const isOwnReference = (name: string, value: string): boolean =>
  value === "initial" || value.replace(/\s/g, "") === `var(${name})`;

/**
 * Whether a line of a file sets a name: in quotes (`variable: "--font-sans"`, `style={{ "--gap": … }}`,
 * `setProperty("--gap", …)`), as a declaration (`--gap: 4px`) that is not only its own name, a Svelte `style:` directive
 * or a Tailwind arbitrary property (`[--gap:4px]`). A reference is `var(--gap)`, which none of these match.
 */
const setsName = (line: string, name: string): boolean => {
  if (
    [`"${name}"`, `'${name}'`, `\`${name}\``, `style:${name}=`, `[${name}:`].some((form) =>
      line.includes(form)
    )
  ) {
    return true;
  }
  const at = line.indexOf(`${name}:`);
  if (at === -1) return false;
  const value = line.slice(at + name.length + 1).split(/[;}]/)[0] ?? "";
  return !isOwnReference(name, value.trim());
};

/**
 * The names among some that the repository's files set, searched as fixed strings, which git matches all at once where
 * a pattern per name takes seconds; the strings go on its input, since a command line has a limit on Windows. None when
 * the files cannot be searched.
 */
const namesSetIn = (root: string, names: readonly string[]): ReadonlySet<string> | undefined => {
  // a repository's configuration may name a program for git to run: nothing here is to run
  const found = spawnSync(
    "git",
    [
      "-c",
      "core.fsmonitor=false",
      "grep",
      "--untracked",
      "-I",
      "-h",
      "-F",
      "-f",
      "-",
      "--",
      ...SEARCHED_FILES
    ],
    {
      cwd: root,
      input: names.join("\n"),
      encoding: "utf8",
      timeout: SEARCH_TIMEOUT,
      maxBuffer: 64 * 1024 * 1024
    }
  );
  if (found.status === 1) return new Set();
  if (found.status !== 0) return undefined;
  const lines = found.stdout.split("\n");
  return new Set(names.filter((name) => lines.some((line) => line.includes(name) && setsName(line, name))));
};

/** Where a declaration stands, for a line that names it. */
const placeOf = ({ origin }: TokenDeclaration): string =>
  origin.line === undefined ? origin.file : `${origin.file}:${origin.line}`;

/** What is wrong with a declaration, without where. */
const whatOf = (broken: BrokenReference): string => {
  const { name } = broken.declaration;
  if (broken.kind === "undeclared") return `${name} reads var(${broken.target})`;
  const shown = broken.through.slice(0, MOST_NAMED);
  const more = broken.through.length - shown.length;
  const names = more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
  const theme = broken.mode === undefined ? "" : ` in the ${broken.mode} theme`;
  return `${name} leads back to ${shown.length === 0 ? "itself" : `itself through ${names}`}${theme}`;
};

/** A problem's line. */
const problemOf = (broken: BrokenReference): string => {
  const at = placeOf(broken.declaration);
  if (broken.kind === "cycle") return `${at}: ${whatOf(broken)}, so a browser gives it no value`;
  return `${at}: ${whatOf(broken)}, which nothing declares, so a browser gives it no value: declare ${broken.target} or give it a fallback`;
};

/**
 * What could not be told for one reason, one line a token, or one line in all past a few: an application whose
 * dependencies are not installed has hundreds, and each says the same.
 */
const unsureLines = (unsure: readonly BrokenReference[], why: string): string[] => {
  if (unsure.length <= MOST_NAMED)
    return unsure.map((each) => `${placeOf(each.declaration)}: ${whatOf(each)}: ${why}`);
  const shown = unsure.slice(0, MOST_NAMED).map(whatOf).join("; ");
  return [
    `${unsure.length} tokens may have no value (${shown}; and ${unsure.length - MOST_NAMED} more): ${why}`
  ];
};

/** Why a name nothing read declares cannot be called missing; none when it can. */
const doubtOf = (
  unreadable: readonly string[],
  hasBuiltNames: boolean,
  setInFiles: ReadonlySet<string> | undefined
): string | undefined => {
  if (setInFiles === undefined)
    return "nothing read declares it, and the repository could not be searched for it";
  if (hasBuiltNames)
    return "nothing read declares it, and a sheet builds names with Sass or Less, which only running it knows";
  if (unreadable.length > 0) {
    const named = unreadable.map((each) => `"${each}"`).join(", ");
    return `nothing read declares it; it may come from ${named}, which could not be read`;
  }
  return undefined;
};

/**
 * Finds the tokens that resolve to nothing.
 *
 * @param dir - the catalogue's folder, its links followed.
 * @param read - the sheets and configurations read, and the declarations tokens are made from, the lowest first.
 */
export const unresolvedTokens = (
  dir: string,
  read: {
    readonly sheets: readonly ReadSheet[];
    readonly configs: readonly ReadConfig[];
    readonly declarations: readonly TokenDeclaration[];
  }
): UnresolvedTokens => {
  const packages = importedPackageSheets(dir, read.sheets);
  const declared = declaredNames(
    [...read.sheets.map(({ reading }) => reading), ...packages.texts.map((text) => readCssText(text))],
    [...read.sheets.map(({ text }) => text), ...packages.texts]
  );
  for (const { reading } of read.configs) for (const { name } of reading.tokens) declared.add(name);
  const broken = brokenReferences(read.declarations, (name) => declared.has(name)).filter(
    ({ declaration }) => declaration.origin.kind !== "tailwind-default"
  );
  const missing = [...new Set(broken.flatMap((each) => (each.kind === "undeclared" ? [each.target] : [])))];
  const setInFiles = missing.length === 0 ? new Set<string>() : namesSetIn(repositoryOf(dir), missing);
  const hasBuiltNames = read.sheets.some(({ text }) => BUILT_NAME.test(text));
  const doubt = doubtOf(packages.unreadable, hasBuiltNames, setInFiles);
  const problems: string[] = [];
  const inTheme: BrokenReference[] = [];
  const doubted: BrokenReference[] = [];
  for (const each of broken) {
    if (each.kind === "cycle" && each.mode !== undefined) inTheme.push(each);
    else if (each.kind === "cycle" || (doubt === undefined && setInFiles?.has(each.target) !== true)) {
      problems.push(problemOf(each));
    } else if (setInFiles?.has(each.target) !== true) doubted.push(each);
  }
  return {
    problems,
    unread: [
      ...unsureLines(inTheme, "a browser gives it no value if the theme is set on the root, as its base is"),
      ...(doubt === undefined ? [] : unsureLines(doubted, doubt))
    ]
  };
};
