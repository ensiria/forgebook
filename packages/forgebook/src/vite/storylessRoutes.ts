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
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import type { CheckedCodeDocument } from "./agent.types.ts";
import type { AgentAnswer } from "./agentRoutes.ts";
import { addedLines, checkedCode, deletedTests, fileLines } from "./checkCode.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { gitChange, gitOutput } from "./gitChange.ts";
import { readTokenFiles, type SourceTokens, sourceTokensIn } from "./sourceTokens.ts";
import { TOKEN_ANSWERS, type TokenReading, tokenSummary } from "./tokenAnswers.ts";

/** Finds the file of a source's module specifier. */
export type ResolveSource = (specifier: string) => Promise<string | undefined>;

/** What one source's module declares; a module the bundler answers itself has no text to read, so it declares none. */
const sourceDeclaration = async (specifier: string, resolveSource: ResolveSource): Promise<SourceTokens> => {
  const none = { id: undefined, files: [], problems: [] };
  try {
    const id = await resolveSource(specifier);
    if (id === undefined) return { ...none, unread: `${specifier}: not found` };
    const file = id.split("?")[0] ?? id;
    return isAbsolute(file) ? sourceTokensIn(file, specifier) : none;
  } catch (error) {
    return { ...none, unread: `${specifier}: ${error instanceof Error ? error.message : String(error)}` };
  }
};

/**
 * The catalogue's tokens, read at each question, so an edited file answers at once and costs nothing unasked. Sources
 * are read from their modules' text, each source's files before the catalogue's, which win a clash.
 *
 * @param config - the catalogue's configuration.
 * @param resolveSource - finds the file of a source's module.
 */
export const catalogueTokens = async (
  config: ResolvedConfig,
  resolveSource: ResolveSource
): Promise<TokenReading> => {
  const declared = await Promise.all(
    config.sources.map((specifier) => sourceDeclaration(specifier, resolveSource))
  );
  const own = config.tokens.map(({ path, mode }) => ({ path, mode, label: relative(config.dir, path) }));
  const files = [...declared.flatMap((source) => source.files), ...own];
  const { tokens, problems, clashes } = readTokenFiles(files);
  const declaring = declared.flatMap((source) => source.problems);
  return {
    tokens,
    clashes,
    problems: [...declaring, ...problems],
    unread: declared.flatMap((source) => (source.unread === undefined ? [] : [source.unread])),
    isConfigured: files.length > 0 || declaring.length > 0
  };
};

/**
 * The tokens' module, for a designer's page: what a list gives, and what could not be read. A static build has no
 * server to ask, so the page imports them.
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
  for (const { path } of config.tokens) watch(path);
  const { tokens, problems, unread } = await catalogueTokens(config, resolveSource);
  const value = { tokens: tokens.map(tokenSummary), problems: [...unread, ...problems] };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
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
  const { tokens, problems, unread } = await catalogueTokens(config, resolveSource);
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
  const hasTokens = tokens.length > 0;
  const body: CheckedCodeDocument = {
    schema: 1,
    since,
    checked: hasTokens
      ? ["raw-color", "raw-size", "suppression", "deleted-test"]
      : ["suppression", "deleted-test"],
    skipped: [
      ...(hasTokens ? [] : ["Colours and sizes: this catalogue names no tokens file."]),
      ...unread.map((source) => `Tokens of a source: ${source}`)
    ],
    problems: [
      ...checkedCode([...addedLines(change.diff), ...fresh.flat()], tokens),
      ...deletedTests(change.deleted)
    ]
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
