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

import type {
  AgentTokenSummary,
  CheckedCodeDocument,
  NearestTokensDocument,
  TokenDocument,
  TokensDocument
} from "./agent.types.ts";
import type { AgentAnswer } from "./agentRoutes.ts";
import { addedLines, checkedCode, deletedTests, fileLines } from "./checkCode.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { type DesignToken, filteredTokens, type ParsedTokens } from "./designTokens.ts";
import { gitChange, gitOutput } from "./gitChange.ts";
import { nearestTokens } from "./nearestToken.ts";
import { readTokenFiles, type SourceTokens, sourceTokensIn } from "./sourceTokens.ts";

/** A list's size unless asked otherwise: an agent degrades on long answers, and asks `nearest` or one token. */
const TOKENS_LIMIT = 100;

/** The one answer a question about a catalogue with no tokens gets, so an agent does not read it as "no such token". */
const NO_TOKENS_FILE: AgentAnswer = {
  status: 404,
  body: {
    error:
      'This catalogue names no tokens file: `tokens: ["tokens.json"]` in forgebook.config.ts, or on a source it shows'
  }
};

/** Finds the file of a source's module specifier. */
type ResolveSource = (specifier: string) => Promise<string | undefined>;

/** The tokens, with whether anything names some: a file that cannot be read is named, and that is not "no tokens". */
type CatalogueTokens = ParsedTokens & {
  /** Whether the catalogue or a source names a tokens file. */
  readonly isConfigured: boolean;
  /** The sources whose modules could not be read: whether they hold tokens is not known. */
  readonly unread: readonly string[];
};

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
 */
const catalogueTokens = async (
  config: ResolvedConfig,
  resolveSource: ResolveSource
): Promise<CatalogueTokens> => {
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

/** How many tokens of each type. */
const typeCounts = (tokens: readonly DesignToken[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const { type } of tokens) counts[type] = (counts[type] ?? 0) + 1;
  return counts;
};

/** A token as a list gives it: no description, and no empty fields, since each one costs an agent's context. */
const tokenSummary = (token: DesignToken): AgentTokenSummary => {
  const { name, type, value, modes, deprecated, isThemeOnly } = token;
  return {
    name,
    type,
    value,
    modes,
    ...(deprecated === undefined ? {} : { deprecated }),
    ...(isThemeOnly === undefined ? {} : { isThemeOnly })
  };
};

/** The tokens, of a category when one is asked for, up to a limit, with how many there are. */
const tokensAnswer = async (
  config: ResolvedConfig,
  params: URLSearchParams,
  resolveSource: ResolveSource
): Promise<AgentAnswer> => {
  const { tokens, problems, unread, clashes, isConfigured } = await catalogueTokens(config, resolveSource);
  const chosen = filteredTokens(tokens, params.get("category") || undefined);
  const limit = Number(params.get("limit") || TOKENS_LIMIT);
  const listed = chosen.slice(0, Number.isFinite(limit) ? limit : TOKENS_LIMIT);
  const names = new Set(listed.map((token) => token.name));
  const body: TokensDocument = {
    schema: 1,
    isConfigured,
    total: chosen.length,
    types: typeCounts(chosen),
    tokens: listed.map(tokenSummary),
    problems: [...unread, ...problems],
    clashes: clashes.filter((clash) => names.has(clash.name))
  };
  return { status: 200, body };
};

/** One token; what broke in the files is said, since a token that failed to read looks like one that is not there. */
const tokenAnswer = async (
  config: ResolvedConfig,
  params: URLSearchParams,
  resolveSource: ResolveSource
): Promise<AgentAnswer> => {
  const read = await catalogueTokens(config, resolveSource);
  if (!read.isConfigured) return NO_TOKENS_FILE;
  const { tokens, clashes } = read;
  const problems = [...read.unread, ...read.problems];
  const name = params.get("name") ?? "";
  const token = tokens.find((each) => each.name === name);
  if (token === undefined) {
    const read = problems.length === 0 ? "" : ` (and the tokens files have problems: ${problems.join("; ")})`;
    return { status: 404, body: { error: `No token "${name}"${read}` } };
  }
  const body: TokenDocument = {
    schema: 1,
    token,
    problems,
    clashes: clashes.filter((clash) => clash.name === name)
  };
  return { status: 200, body };
};

/** The tokens nearest a value; a question that cannot be answered is an error, never an empty list. */
const nearestTokenAnswer = async (
  config: ResolvedConfig,
  params: URLSearchParams,
  resolveSource: ResolveSource
): Promise<AgentAnswer> => {
  const { tokens, problems, unread, isConfigured } = await catalogueTokens(config, resolveSource);
  if (!isConfigured) return NO_TOKENS_FILE;
  const value = params.get("value") ?? "";
  if (value === "") return { status: 400, body: { error: "No value to compare" } };
  const nearest = nearestTokens(tokens, value, params.get("type") || undefined);
  if (nearest.reason !== undefined) return { status: 400, body: { error: nearest.reason } };
  const body: NearestTokensDocument = { schema: 1, value, ...nearest, problems: [...unread, ...problems] };
  return { status: 200, body };
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
  tokens: tokensAnswer,
  token: tokenAnswer,
  "nearest-token": nearestTokenAnswer,
  "check-code": checkCodeAnswer
};
