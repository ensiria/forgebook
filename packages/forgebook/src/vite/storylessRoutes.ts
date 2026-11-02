/**
 * The answers that read no story: the design tokens, and what a change adds against them.
 *
 * @remarks
 * Kept from the stories' answers on purpose: the sources are not loaded for them, so a story broken mid-edit, which is
 * when an agent asks, cannot take them down, and a token question costs no bundling.
 *
 * @module
 */
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

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
import {
  type DesignToken,
  filteredTokens,
  type ParsedTokens,
  readTokens,
  type TokensInput
} from "./designTokens.ts";
import { gitChange, gitOutput } from "./gitChange.ts";
import { nearestTokens } from "./nearestToken.ts";

/** A list's size unless asked otherwise: an agent degrades on long answers, and asks `nearest` or one token. */
const TOKENS_LIMIT = 100;

/** The one answer a question about a catalogue with no tokens gets, so an agent does not read it as "no such token". */
const NO_TOKENS_FILE: AgentAnswer = {
  status: 404,
  body: { error: 'This catalogue names no tokens file: `tokens: ["tokens.json"]` in forgebook.config.ts' }
};

/** The catalogue's tokens, read at each question, so an edited file answers at once and costs nothing unasked. */
const catalogueTokens = async (config: ResolvedConfig): Promise<ParsedTokens> => {
  const unread: string[] = [];
  const inputs = await Promise.all(
    config.tokens.map(async ({ path, mode }): Promise<TokensInput[]> => {
      try {
        return [{ label: relative(config.dir, path), mode, file: JSON.parse(await readFile(path, "utf8")) }];
      } catch (error) {
        unread.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    })
  );
  const { tokens, problems } = readTokens(inputs.flat());
  return { tokens, problems: [...unread, ...problems] };
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
const tokensAnswer = async (config: ResolvedConfig, params: URLSearchParams): Promise<AgentAnswer> => {
  const { tokens, problems } = await catalogueTokens(config);
  const chosen = filteredTokens(tokens, params.get("category") || undefined);
  const limit = Number(params.get("limit") || TOKENS_LIMIT);
  const body: TokensDocument = {
    schema: 1,
    isConfigured: config.tokens.length > 0,
    total: chosen.length,
    types: typeCounts(chosen),
    tokens: chosen.slice(0, Number.isFinite(limit) ? limit : TOKENS_LIMIT).map(tokenSummary),
    problems
  };
  return { status: 200, body };
};

/** One token; what broke in the files is said, since a token that failed to read looks like one that is not there. */
const tokenAnswer = async (config: ResolvedConfig, params: URLSearchParams): Promise<AgentAnswer> => {
  if (config.tokens.length === 0) return NO_TOKENS_FILE;
  const name = params.get("name") ?? "";
  const { tokens, problems } = await catalogueTokens(config);
  const token = tokens.find((each) => each.name === name);
  if (token === undefined) {
    const read = problems.length === 0 ? "" : ` (and the tokens files have problems: ${problems.join("; ")})`;
    return { status: 404, body: { error: `No token "${name}"${read}` } };
  }
  const body: TokenDocument = { schema: 1, token, problems };
  return { status: 200, body };
};

/** The tokens nearest a value; a question that cannot be answered is an error, never an empty list. */
const nearestTokenAnswer = async (config: ResolvedConfig, params: URLSearchParams): Promise<AgentAnswer> => {
  if (config.tokens.length === 0) return NO_TOKENS_FILE;
  const value = params.get("value") ?? "";
  if (value === "") return { status: 400, body: { error: "No value to compare" } };
  const { tokens, problems } = await catalogueTokens(config);
  const nearest = nearestTokens(tokens, value, params.get("type") || undefined);
  if (nearest.reason !== undefined) return { status: 400, body: { error: nearest.reason } };
  const body: NearestTokensDocument = { schema: 1, value, ...nearest, problems };
  return { status: 200, body };
};

/**
 * What a change adds that breaks the design system. It needs nothing of the stories, like the tokens, so a story broken
 * mid-edit does not stop it; tokens that were asked for and cannot be read do, or a check would pass having checked less.
 *
 * @param config - the catalogue's configuration.
 * @param params - the query: `since`, the commit to compare with.
 */
const checkCodeAnswer = async (config: ResolvedConfig, params: URLSearchParams): Promise<AgentAnswer> => {
  const since = params.get("since") || "HEAD";
  const { tokens, problems } = await catalogueTokens(config);
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
    skipped: hasTokens ? [] : ["Colours and sizes: this catalogue names no tokens file."],
    problems: [
      ...checkedCode([...addedLines(change.diff), ...fresh.flat()], tokens),
      ...deletedTests(change.deleted)
    ]
  };
  return { status: 200, body };
};

/** The answers that need nothing of the stories, so a story broken mid-edit cannot take them down. */
export const STORYLESS_ROUTES: Readonly<
  Record<string, (config: ResolvedConfig, params: URLSearchParams) => Promise<AgentAnswer>>
> = {
  tokens: tokensAnswer,
  token: tokenAnswer,
  "nearest-token": nearestTokenAnswer,
  "check-code": checkCodeAnswer
};
