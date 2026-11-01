/**
 * What `forgebook errors` and the MCP tool `recent_errors` run: the errors the open frames reported, asked of the
 * catalogue once, or followed as they come.
 *
 * @module
 */
import { setTimeout as sleep } from "node:timers/promises";

import type { ErrorsDocument } from "../../src/vite/agent.types.ts";
import { isErrorsDocument } from "../../src/vite/agentApi.ts";
import type { CatalogueClient } from "./agentClient.ts";

/** How often a follower asks for new errors, in ms. */
const FOLLOW_MS = 1000;

/**
 * The number to ask for the errors after, from the command line: 0, every error kept, when none or not a number.
 *
 * @param text - `--since`'s value, if given.
 */
export const sinceOf = (text: string | undefined): number => {
  const since = Number(text ?? "0");
  return Number.isInteger(since) && since > 0 ? since : 0;
};

/**
 * The errors after a number, and the index's problems.
 *
 * @param ask - asks the catalogue.
 * @param since - the number of the last error already read; 0 for every one kept.
 * @returns the document, or why the catalogue could not answer.
 */
export const askErrors = async (
  ask: CatalogueClient["ask"],
  since: number
): Promise<ErrorsDocument | string> => {
  let answer: Awaited<ReturnType<CatalogueClient["ask"]>>;
  try {
    answer = await ask("errors", new URLSearchParams({ since: String(since) }));
  } catch (error) {
    // the dev server stopped or restarted: said, not thrown
    return `The catalogue stopped answering: ${error instanceof Error ? error.message : String(error)}`;
  }
  return answer.status === 200 && isErrorsDocument(answer.body)
    ? answer.body
    : `The catalogue answered ${answer.status} for its errors`;
};

/**
 * Follows the errors: each answer with new ones handed on, until the catalogue stops answering or the signal aborts.
 *
 * @param ask - asks the catalogue.
 * @param since - the number of the last error already read.
 * @param onErrors - called with each answer that has new errors.
 * @param signal - stops following; none to follow until the process ends.
 * @returns why it stopped, when the catalogue could not answer.
 */
export const followErrors = async (
  ask: CatalogueClient["ask"],
  since: number,
  onErrors: (document: ErrorsDocument) => void,
  signal?: AbortSignal
): Promise<string | undefined> => {
  let last = since;
  while (signal?.aborted !== true) {
    const document = await askErrors(ask, last);
    if (typeof document === "string") return document;
    // a restarted dev server numbers its errors from 1 again: asked from the old number it would hold back its new ones,
    // so it is asked from the start once more
    if (document.last < last) {
      last = 0;
      continue;
    }
    if (document.errors.length > 0) onErrors(document);
    last = document.last;
    try {
      await sleep(FOLLOW_MS, undefined, signal === undefined ? {} : { signal });
    } catch {
      // aborted while waiting: the loop's own check ends it
    }
  }
  return undefined;
};
