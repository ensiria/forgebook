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

import type { CheckedCodeDocument } from "./agent.types.ts";
import type { AgentAnswer } from "./agentRoutes.ts";
import { addedLines, checkedCode, deletedTests, fileLines } from "./checkCode.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { readTokens, type TokensInput } from "./designTokens.ts";
import { gitChange, gitOutput } from "./gitChange.ts";
import { TOKEN_ANSWERS, type TokenReading } from "./tokenAnswers.ts";

/** The catalogue's tokens, read at each question, so an edited file answers at once and costs nothing unasked. */
export const catalogueTokens = async (config: ResolvedConfig): Promise<TokenReading> => {
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
  return { tokens, problems: [...unread, ...problems], isConfigured: config.tokens.length > 0 };
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
  ...Object.fromEntries(
    Object.entries(TOKEN_ANSWERS).map(([route, answer]) => [
      route,
      async (config: ResolvedConfig, params: URLSearchParams): Promise<AgentAnswer> =>
        answer(await catalogueTokens(config), params)
    ])
  ),
  "check-code": checkCodeAnswer
};
