/**
 * The answers about a catalogue's design tokens, from tokens already read: the dev server reads its files at each
 * question, a built catalogue has them in its index.
 *
 * @module
 */
import type {
  AgentTokenSummary,
  NearestTokensDocument,
  TokenDocument,
  TokensDocument
} from "./agent.types.ts";
import type { AgentAnswer } from "./agentRoutes.ts";
import { type DesignToken, filteredTokens, type ParsedTokens } from "./designTokens.ts";
import { nearestTokens } from "./nearestToken.ts";

/** The tokens read, with whether anything names some: a file that cannot be read is named, and that is not "no tokens". */
export type TokenReading = ParsedTokens & {
  /** Whether the catalogue or a source names a tokens file. */
  readonly isConfigured: boolean;
  /** The sources whose modules could not be read: whether they hold tokens is not known. */
  readonly unread: readonly string[];
};

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

/** How many tokens of each type. */
const typeCounts = (tokens: readonly DesignToken[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const { type } of tokens) counts[type] = (counts[type] ?? 0) + 1;
  return counts;
};

/** A token as a list gives it: no description, and no empty fields, since each one costs an agent's context. */
export const tokenSummary = (token: DesignToken): AgentTokenSummary => {
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
const tokensAnswer = (
  { tokens, problems, unread, clashes, isConfigured }: TokenReading,
  params: URLSearchParams
): AgentAnswer => {
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
const tokenAnswer = (reading: TokenReading, params: URLSearchParams): AgentAnswer => {
  if (!reading.isConfigured) return NO_TOKENS_FILE;
  const { tokens, clashes } = reading;
  const problems = [...reading.unread, ...reading.problems];
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
const nearestTokenAnswer = (
  { tokens, problems, unread, isConfigured }: TokenReading,
  params: URLSearchParams
): AgentAnswer => {
  if (!isConfigured) return NO_TOKENS_FILE;
  const value = params.get("value") ?? "";
  if (value === "") return { status: 400, body: { error: "No value to compare" } };
  const nearest = nearestTokens(tokens, value, params.get("type") || undefined);
  if (nearest.reason !== undefined) return { status: 400, body: { error: nearest.reason } };
  const body: NearestTokensDocument = { schema: 1, value, ...nearest, problems: [...unread, ...problems] };
  return { status: 200, body };
};

/** The token questions, by the API's path. */
export const TOKEN_ANSWERS: Readonly<
  Record<string, (reading: TokenReading, params: URLSearchParams) => AgentAnswer>
> = {
  tokens: tokensAnswer,
  token: tokenAnswer,
  "nearest-token": nearestTokenAnswer
};
