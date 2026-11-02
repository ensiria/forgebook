/**
 * What `forgebook tokens` does: one of three questions, by what it was given.
 *
 * @module
 */
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { isNearestTokensDocument, isTokenDocument, isTokensDocument } from "../../src/vite/agentApi.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { nearestTokensText, tokensText, tokenText } from "./agentText.ts";
import { askCatalogue, printAnswer, printTokenAnswer } from "./catalogueCommands.ts";

/** Where the answers come from and go. */
export type TokensReach = {
  /** The catalogue. */
  readonly config: ResolvedConfig;
  /** Its dev server's address, when not the default. */
  readonly url: string | undefined;
  /** Where the answer goes. */
  readonly context: { readonly io: ScriptIo; readonly log: Logger; readonly isJson: boolean };
};

/** What was asked. */
export type TokensQuestion = {
  /** One token's name. */
  readonly name: string | undefined;
  /** A value to find the nearest tokens of. */
  readonly nearest: string | undefined;
  /** A type or first group, for the list. */
  readonly category: string | undefined;
  /** What to compare with, for the nearest. */
  readonly type: string | undefined;
  /** The most tokens a list gives. */
  readonly limit: string | undefined;
};

/** The answer had a shape this version does not read. */
const unexpected = (): ScriptError => new ScriptError("The catalogue's answer has an unexpected shape");

/**
 * Answers `forgebook tokens`.
 *
 * @param reach - where the answers come from and go.
 * @param question - what was asked.
 */
export const runTokens = async (
  { config, url, context }: TokensReach,
  { name, nearest, category, type, limit }: TokensQuestion
): Promise<void> => {
  const { log } = context;
  if (nearest !== undefined && name !== undefined) {
    throw new ScriptError("Give a token's name or --nearest, not both");
  }
  if (nearest !== undefined) {
    const params = new URLSearchParams({ value: nearest, type: type ?? "" });
    const body = await askCatalogue(config, url, "nearest-token", params, log);
    if (!isNearestTokensDocument(body)) throw unexpected();
    printTokenAnswer(nearestTokensText(body), body, context);
    return;
  }
  if (name !== undefined) {
    const body = await askCatalogue(config, url, "token", new URLSearchParams({ name }), log);
    if (!isTokenDocument(body)) throw unexpected();
    printTokenAnswer(tokenText(body.token), body, context);
    return;
  }
  const params = new URLSearchParams({ category: category ?? "", limit: limit ?? "" });
  const body = await askCatalogue(config, url, "tokens", params, log);
  if (!isTokensDocument(body)) throw unexpected();
  printAnswer(tokensText(body), body, body.problems, context);
};
