/**
 * The answers that read no story: the design tokens, and what a change adds against them.
 *
 * @remarks
 * Kept from the stories' answers on purpose: the sources are not loaded for them, so a story broken mid-edit, which is
 * when an agent asks, cannot take them down, and a token question costs no bundling. A source's tokens are read from
 * its module's text for the same reason: the module imports the stories' index, a language's texts, its named values.
 *
 * @module
 */
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { codeLiteral } from "../codeLiteral.ts";
import type { CheckedCodeDocument } from "./agent.types.ts";
import type { AgentAnswer } from "./agentRoutes.ts";
import { smallFileText } from "./appTokenFiles.ts";
import { type AppTokens, readAppTokens } from "./appTokens.ts";
import {
  type AddedLine,
  addedLines,
  type CodeProblem,
  checkedCode,
  deletedTests,
  excusedValues,
  fileLines,
  LEFT_ALONE
} from "./checkCode.ts";
import { currentComponents } from "./componentCache.ts";
import { COMPONENT_FILE } from "./componentScan.ts";
import type { ResolvedConfig } from "./configFile.ts";
import type { DesignToken } from "./designTokens.ts";
import { type GitChange, gitChange, gitOutput } from "./gitChange.ts";
import { type ProjectFile, workspacePackages } from "./projectFiles.ts";
import { type ReuseFindings, reuseFindings } from "./reuseCheck.ts";
import { readTokenFiles, type SourceTokens, sourceTokensIn } from "./sourceTokens.ts";
import { TOKEN_ANSWERS, type TokenReading, tokenSummary } from "./tokenAnswers.ts";

/** How many component files a change may touch and still be compared: past this it is a move or a rewrite. */
const MOST_REUSE_FILES = 300;

/** Fewer colours than this in what an application declares is no palette to compare with. */
const FEWEST_COLORS = 5;

/** Finds the file of a source's module specifier. */
export type ResolveSource = (specifier: string) => Promise<string | undefined>;

/**
 * What one source's module declares; a module the bundler answers itself has no text to read, so it declares none.
 *
 * @param specifier - the source's module, as the configuration names it.
 * @param resolveSource - finds its file.
 * @param watch - told of the module's file, whose edit may name other tokens files.
 */
const sourceDeclaration = async (
  specifier: string,
  resolveSource: ResolveSource,
  watch: (file: string) => void
): Promise<SourceTokens> => {
  const none = { id: undefined, files: [], problems: [] };
  try {
    const id = await resolveSource(specifier);
    if (id === undefined) return { ...none, unread: `${specifier}: not found` };
    const file = id.split("?")[0] ?? id;
    if (!isAbsolute(file)) return none;
    watch(file);
    return sourceTokensIn(file, specifier);
  } catch (error) {
    return { ...none, unread: `${specifier}: ${error instanceof Error ? error.message : String(error)}` };
  }
};

/**
 * The tokens a catalogue and its sources name, read at each question, so an edited file answers at once and costs nothing
 * unasked. Sources are read from their modules' text, each source's files before the catalogue's, which win a clash.
 *
 * @param config - the catalogue's configuration.
 * @param resolveSource - finds the file of a source's module.
 * @param watch - told of every file read: the sources' modules and the tokens files; none by default.
 */
const namedTokens = async (
  config: ResolvedConfig,
  resolveSource: ResolveSource,
  watch: (file: string) => void = (): undefined => undefined
): Promise<TokenReading> => {
  const declared = await Promise.all(
    config.sources.map((specifier) => sourceDeclaration(specifier, resolveSource, watch))
  );
  const own = config.tokens.map(({ path, mode }) => ({ path, mode, label: relative(config.dir, path) }));
  const files = [...declared.flatMap((source) => source.files), ...own];
  for (const { path } of files) watch(path);
  const { tokens, problems, clashes } = readTokenFiles(files);
  const declaring = declared.flatMap((source) => source.problems);
  return {
    tokens,
    clashes,
    problems: [...declaring, ...problems],
    unread: declared.flatMap((source) => (source.unread === undefined ? [] : [source.unread])),
    isConfigured: files.length > 0 || declaring.length > 0,
    sources: files.map(({ label }) => ({ kind: "tokens-file", file: label })),
    notes: []
  };
};

/** What the application declares; a failure of the system (a folder gone) is a note, with no machine's path in it. */
const appTokensOf = (dir: string): AppTokens => {
  try {
    return readAppTokens(dir);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "an error";
    return { tokens: [], clashes: [], sources: [], files: [], unread: [`the application's files: ${code}`] };
  }
};

/**
 * The tokens an agent is answered from: what the catalogue and its sources name or, when they name none, what the
 * application already declares, which is read from its files and never run. A catalogue that says `tokens: []` wants
 * none, so a named file is not the only way to say so.
 *
 * @param config - the catalogue's configuration.
 * @param resolveSource - finds the file of a source's module.
 * @param watch - told of every file read; none by default.
 */
export const catalogueTokens = async (
  config: ResolvedConfig,
  resolveSource: ResolveSource,
  watch: (file: string) => void = (): undefined => undefined
): Promise<TokenReading> => {
  const named = await namedTokens(config, resolveSource, watch);
  if (named.isConfigured || config.isAppTokensOff === true) return named;
  const app = appTokensOf(config.dir);
  for (const file of app.files) watch(file);
  return {
    ...named,
    tokens: app.tokens,
    clashes: app.clashes,
    isConfigured: app.tokens.length > 0,
    sources: app.sources,
    notes: app.unread
  };
};

/**
 * The tokens' module, for a designer's page: what a list gives, and what could not be read. A static build has no
 * server to ask, so the page imports them; a problem names a file from the catalogue's folder (`./tokens.json`),
 * since a published page must not carry the building machine's paths.
 *
 * @param config - the catalogue's configuration.
 * @param watch - adds a file whose edit renews the module.
 * @param resolveSource - finds the file of a source's module.
 */
export const tokensModule = async (
  config: ResolvedConfig,
  watch: (file: string) => void,
  resolveSource: ResolveSource
): Promise<{ code: string; moduleType: "js" }> => {
  const { tokens, problems, unread } = await namedTokens(config, resolveSource, watch);
  // in both forms: Vite's, and the system's, which a Windows error message writes
  const shown = (problem: string): string =>
    problem.replaceAll(config.dir, ".").replaceAll(resolve(config.dir), ".");
  const value = { tokens: tokens.map(tokenSummary), problems: [...unread, ...problems].map(shown) };
  return { code: `export default ${codeLiteral(value)};`, moduleType: "js" };
};

/**
 * The tokens worth comparing a change with. A named tokens file is the system whatever its size. In what an application
 * merely declares, a handful of colours (a brand colour, a chart's) is no palette: against it every colour written by hand
 * would read as a mistake, and a check that says so on every line gets turned off.
 */
const checkableTokens = ({ tokens, sources }: TokenReading): readonly DesignToken[] => {
  if (sources.some((source) => source.kind === "tokens-file")) return tokens;
  const colors = tokens.filter((token) => token.type === "color").length;
  return colors >= FEWEST_COLORS ? tokens : tokens.filter((token) => token.type !== "color");
};

/**
 * What added lines break: values only in the catalogue's folder when the tokens are what that folder's application
 * declares, since a repository's other packages have systems of their own. A turned-off check is one everywhere.
 */
const codeProblems = (
  added: readonly AddedLine[],
  tokens: readonly DesignToken[],
  inFolder: (file: string) => boolean
): CodeProblem[] => [
  ...checkedCode(
    added.filter(({ file }) => inFolder(file)),
    tokens
  ),
  ...checkedCode(
    added.filter(({ file }) => !inFolder(file)),
    []
  )
];

/** What a change's values were not compared with, and why, in the words `skipped` gives. */
const notCheckedLine = (hasColors: boolean, hasSizes: boolean, { tokens }: TokenReading): string[] => {
  if (hasColors && hasSizes) return [];
  const what = [...(hasColors ? [] : ["colours"]), ...(hasSizes ? [] : ["sizes"])].join(" and ");
  const reason =
    tokens.length === 0
      ? "no tokens file"
      : `too few tokens of that kind in the application (${tokens.length})`;
  return [`${what} not checked: ${reason}`];
};

/** What a change's files were, at the commit it starts from: a file it adds has none. */
const filesAtBase = async (
  root: string,
  base: string,
  files: readonly string[]
): Promise<readonly ProjectFile[]> => {
  const read = await Promise.all(
    files.map(async (file) => ({
      file,
      text: await gitOutput(root, "show", `${base}:${file}`).catch(() => undefined)
    }))
  );
  return read.flatMap(({ file, text }) => (text === undefined ? [] : [{ file, text }]));
};

/**
 * What a change adds against the project's components, read over the whole repository, since the one a new component
 * copies may live in another package. Only a change to a component's file costs this reading.
 */
const reuseOf = async (
  root: string,
  change: GitChange,
  added: readonly AddedLine[]
): Promise<ReuseFindings & { readonly notes: readonly string[] }> => {
  const isComponent = (file: string): boolean => COMPONENT_FILE.test(file) && !LEFT_ALONE.test(file);
  const touched = new Set(added.flatMap(({ file }) => (isComponent(file) ? [file] : [])));
  const empty = { problems: [], advice: [], excused: [], notes: [] };
  if (touched.size === 0) return empty;
  const deleted = change.deleted.filter(isComponent);
  if (touched.size + deleted.length > MOST_REUSE_FILES) {
    return {
      ...empty,
      notes: [`components not compared: the change touches more than ${MOST_REUSE_FILES} of them`]
    };
  }
  const notes: string[] = [];
  const components = currentComponents(root, notes);
  const changed = [...touched].flatMap((file) => {
    const text = smallFileText(join(root, file));
    return text === undefined ? [] : [{ file, text }];
  });
  const findings = reuseFindings({
    added,
    changed,
    previous: await filesAtBase(root, change.base, [...touched, ...deleted]),
    components,
    packages: workspacePackages(root)
  });
  return { ...findings, notes: notes.map((note) => `components not all compared: ${note}`) };
};

/**
 * What a change adds that breaks the design system. It needs nothing of the stories, like the tokens, so a story broken
 * mid-edit does not stop it; tokens that were asked for and cannot be read do, or a check would pass having checked less.
 * A source whose module cannot be read is only `skipped`: it may hold no tokens at all.
 *
 * @param config - the catalogue's configuration.
 * @param params - the query: `since`, the commit to compare with.
 * @param resolveSource - finds the file of a source's module.
 */
const checkCodeAnswer = async (
  config: ResolvedConfig,
  params: URLSearchParams,
  resolveSource: ResolveSource
): Promise<AgentAnswer> => {
  const since = params.get("since") || "HEAD";
  const reading = await catalogueTokens(config, resolveSource);
  const { problems, unread } = reading;
  const tokens = checkableTokens(reading);
  if (problems.length > 0) {
    return { status: 400, body: { error: `The tokens files have problems: ${problems.join("; ")}` } };
  }
  const change = await gitChange(config.dir, since);
  if (typeof change === "string") return { status: 400, body: { error: change } };
  const root = (await gitOutput(config.dir, "rev-parse", "--show-toplevel")).trim();
  const fresh = await Promise.all(
    change.untracked.map(async (file) =>
      fileLines(file, await readFile(join(root, file), "utf8").catch(() => ""))
    )
  );
  const hasNamedFile = reading.sources.some((source) => source.kind === "tokens-file");
  const added = [...addedLines(change.diff), ...fresh.flat()];
  const folder = relative(root, await realpath(config.dir)).replaceAll("\\", "/");
  const isInCatalogue = (file: string): boolean =>
    folder === "" || file === folder || file.startsWith(`${folder}/`);
  const inFolder = (file: string): boolean => hasNamedFile || isInCatalogue(file);
  const hasColors = tokens.some((token) => token.type === "color") || (hasNamedFile && tokens.length > 0);
  const hasSizes = tokens.some((token) => token.type === "dimension") || (hasNamedFile && tokens.length > 0);
  const reuse = await reuseOf(
    root,
    change,
    added.filter(({ file }) => isInCatalogue(file))
  );
  const body: CheckedCodeDocument = {
    schema: 1,
    since,
    checked: [
      ...(hasColors ? (["raw-color"] as const) : []),
      ...(hasSizes ? (["raw-size"] as const) : []),
      "suppression",
      "deleted-test",
      "deprecated-component",
      "duplicate-component"
    ],
    skipped: [
      ...notCheckedLine(hasColors, hasSizes, reading),
      ...reuse.notes,
      ...unread.map((source) => `tokens of a source not checked: ${source}`)
    ],
    problems: [...codeProblems(added, tokens, inFolder), ...deletedTests(change.deleted), ...reuse.problems],
    advice: reuse.advice,
    tokenSources: reading.sources,
    tokenClashes: reading.clashes.length,
    tokenNotes: [...reading.notes],
    notCompared: [...new Set(added.flatMap(({ file }) => (inFolder(file) ? [] : [file])))],
    excused: [...excusedValues(added.filter(({ file }) => inFolder(file))), ...reuse.excused]
  };
  return { status: 200, body };
};

/** The answers that need nothing of the stories, so a story broken mid-edit cannot take them down. */
export const STORYLESS_ROUTES: Readonly<
  Record<
    string,
    (config: ResolvedConfig, params: URLSearchParams, resolveSource: ResolveSource) => Promise<AgentAnswer>
  >
> = {
  ...Object.fromEntries(
    Object.entries(TOKEN_ANSWERS).map(([route, answer]) => [
      route,
      async (
        config: ResolvedConfig,
        params: URLSearchParams,
        resolveSource: ResolveSource
      ): Promise<AgentAnswer> => answer(await catalogueTokens(config, resolveSource), params)
    ])
  ),
  "check-code": checkCodeAnswer
};
