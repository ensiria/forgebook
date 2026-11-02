/**
 * What `forgebook check-code` does: asks the catalogue, prints, and fails when the change broke something.
 *
 * @module
 */
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import { isCheckedCodeDocument } from "../../src/vite/agentApi.ts";
import { checkedCodeText } from "./agentText.ts";
import { askCatalogue } from "./catalogueCommands.ts";
import type { TokensReach } from "./tokensRun.ts";

/**
 * Answers `forgebook check-code`.
 *
 * @param reach - where the answer comes from and goes.
 * @param since - the commit to compare with.
 */
export const runCheckCode = async (
  { config, url, context }: TokensReach,
  since: string | undefined
): Promise<void> => {
  const { io, log, isJson } = context;
  const body = await askCatalogue(
    config,
    url,
    "check-code",
    new URLSearchParams({ since: since ?? "" }),
    log
  );
  if (!isCheckedCodeDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
  io.stdout.write(isJson ? formatJson(body) : `${checkedCodeText(body)}\n`);
  if (body.problems.length > 0) {
    throw new ScriptError(`${body.problems.length} problems`, { exitCode: EXIT.failure, isReported: true });
  }
};
