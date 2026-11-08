/**
 * `forgebook migrate`: the codemods of `forgebook`'s breaking changes, run on a project's configuration and preset modules.
 * Lists the changes by default, writes them with `--write`.
 *
 * @module
 */
import { resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import { COMMAND, configPathOf, type ForgebookOptions } from "../catalogueCommands.ts";

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const migrateCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  migrate: forgebook.command({
    summary:
      "Rewrite a project for Forgebook's breaking changes: list them (exit 1 while some are unwritten), then write them with --write.",
    json: true,
    positionals: [
      {
        name: "files",
        variadic: true,
        description:
          "Other modules holding a preset or a configuration, inside the current folder and outside node_modules; the configuration is always read."
      }
    ],
    options: {
      write: { type: "boolean", description: "Write the changes; without it they are only listed." },
      from: {
        type: "string",
        valueName: "version",
        description:
          "The version of forgebook the project upgrades from (0.3.3): only the changes since, including those that keep an old behaviour."
      },
      only: {
        type: "string",
        multiple: true,
        valueName: "id",
        description: "Only this codemod; repeat for more."
      }
    },
    examples: [
      { command: `${COMMAND} migrate --from 0.3.3`, description: "What upgrading from 0.3.3 changes." },
      { command: `${COMMAND} migrate --from 0.3.3 --write`, description: "Make the changes." },
      {
        command: `${COMMAND} migrate src/preset.ts --json`,
        description: "A library's preset too, as an agent asks."
      }
    ],
    run: async ({ positionals, options, io, isJson }): Promise<void> => {
      const { isMigrationPending, requestProblem, runMigrate } = await import("./migrateRun.ts");
      const { migrateText } = await import("./migrateText.ts");
      const request = {
        cwd: process.cwd(),
        config: configPathOf(options.config),
        modules: positionals.map((file) => resolve(file)),
        from: options.from,
        only: options.only.length === 0 ? undefined : options.only,
        isWrite: options.write === true
      };
      const problem = requestProblem(request);
      if (problem !== undefined) throw new ScriptError(problem, { exitCode: EXIT.usage });
      let document: Awaited<ReturnType<typeof runMigrate>>;
      try {
        document = runMigrate(request);
      } catch (error) {
        throw new ScriptError(error instanceof Error ? error.message : String(error));
      }
      io.stdout.write(isJson ? formatJson(document) : `${migrateText(document)}\n`);
      if (isMigrationPending(document))
        throw new ScriptError(document.summary, { exitCode: EXIT.failure, isReported: true });
    }
  })
});
