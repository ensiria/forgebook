/**
 * `forgebook verify`: whether a change is done, with one exit code.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import { catalogueClient } from "./agentClient.ts";
import { verifyText } from "./agentText.ts";
import { COMMAND, configOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { runStoriesCheck } from "./storyCheckRun.ts";
import { isVerifyFailure, runVerify } from "./verifyRun.ts";

/**
 * The command.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const verifyCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  verify: forgebook.command({
    summary:
      "Say whether a change is done: every changed UI file in stories that ran, in every variant, and what it adds against the design system.",
    json: true,
    options: {
      since: {
        type: "string",
        valueName: "ref",
        description:
          "The commit to compare with, from where the branch left it; the default branch by default, so what is committed on this branch counts."
      },
      quick: {
        type: "boolean",
        description: "Only the default view of each story: faster, and the verdict says so."
      },
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    examples: [
      { command: `${COMMAND} verify`, description: "Before you say a change is done." },
      { command: `${COMMAND} verify --since origin/develop --json`, description: "In a pull request." },
      { command: `${COMMAND} verify --quick`, description: "While you work: the default view of each story." }
    ],
    run: async ({ options, io, log, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const client = await catalogueClient(config, options.url);
      try {
        const document = await runVerify(
          {
            dir: config.dir,
            ask: client.ask,
            check: (input) => runStoriesCheck(config, options.url, input)
          },
          { since: options.since, isQuick: options.quick === true }
        );
        if (typeof document === "string") throw new ScriptError(document);
        io.stdout.write(isJson ? formatJson(document) : `${verifyText(document, style)}\n`);
        // the line says them to a person; a pipeline reading the JSON still shows them in its log
        if (isJson) for (const each of document.skipped) log.warn(each);
        if (isVerifyFailure(document))
          throw new ScriptError(document.summary, { exitCode: EXIT.failure, isReported: true });
      } finally {
        await client.close();
      }
    }
  })
});
