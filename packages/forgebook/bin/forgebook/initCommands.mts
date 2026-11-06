/**
 * The command that starts a catalogue: `init` writes `forgebook.config.ts` from what a project's files say, so a new user
 * or an agent gets a catalogue that draws in one command, with no question asked.
 *
 * @remarks
 * Defined here, on the scope `forgebookCommands.mts` hands it, so the commands module stays a list of commands; what it
 * does is `initRun.ts`'s. The run loads the compiler to read the project's files, so only this command loads it. A file
 * already there is never replaced unless asked (`--force`): it may hold a person's work.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";

import { COMMAND, type ForgebookOptions } from "./catalogueCommands.ts";
import { CONFIG_FILE } from "./initConfig.ts";
import { FRAMEWORK_NAMES } from "./newProject/projectFrameworks.ts";

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const initCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  init: forgebook.command({
    summary:
      "Write forgebook.config.ts, and a preview with the app's global style sheets, from the project's files.",
    json: true,
    options: {
      from: {
        type: "string",
        choices: ["storybook"],
        valueName: "tool",
        description:
          "Read this tool's files (its folder in the current one: .storybook, or on-device Storybook's .rnstorybook). Loading its main runs the project's code."
      },
      framework: {
        type: "string",
        valueName: "name",
        choices: [...FRAMEWORK_NAMES],
        description:
          "The framework the stories are written for, when package.json does not settle it (html for none); starts from the dependencies even on Storybook."
      },
      install: {
        type: "boolean",
        description:
          "Run the package manager's install of what the configuration imports; as any install, it runs what the project's package manager settings and the packages' scripts say."
      },
      force: { type: "boolean", description: `Replace a ${CONFIG_FILE} or a preview that is already there.` }
    },
    examples: [
      { command: `${COMMAND} init`, description: "Read the project and write the files." },
      { command: `${COMMAND} init --json`, description: "The same, as a document, for an agent." },
      { command: `${COMMAND} init --from storybook`, description: "Read .storybook." }
    ],
    run: async ({ options, io, log, isJson }): Promise<void> => {
      const { runInit } = await import("./initRun.ts");
      await runInit(
        {
          from: options.from,
          framework: options.framework,
          isForced: options.force === true,
          shouldInstall: options.install === true
        },
        { io, log, isJson }
      );
    }
  })
});
