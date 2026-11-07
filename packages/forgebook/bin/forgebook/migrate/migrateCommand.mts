/**
 * `forgebook migrate`: the codemods of `forgebook`'s breaking changes, run on a project's configuration and preset modules.
 * Lists the changes by default, writes them with `--write`.
 *
 * @module
 */
import { existsSync } from "node:fs";
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
      "Rewrite a project for Forgebook's breaking changes: list the changes, then write them with --write.",
    json: true,
    positionals: [
      {
        name: "files",
        variadic: true,
        description: "Other modules holding a preset or a configuration; the configuration is always read."
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
      const { isMigrationPending, migrateProblem, migrateText, runMigrate } = await import("./migrateRun.ts");
      const choice = { from: options.from, only: options.only.length === 0 ? undefined : options.only };
      const problem = migrateProblem(choice);
      if (problem !== undefined) throw new ScriptError(problem, { exitCode: EXIT.usage });
      const config = configPathOf(options.config);
      const modules = positionals.map((file) => resolve(file));
      if (config === undefined && modules.length === 0)
        throw new ScriptError("No forgebook.config.ts here, and no file given", {
          hint: `Run ${COMMAND} migrate in the catalogue's folder, or give --config or the files`
        });
      const missing = [...(config === undefined ? [] : [config]), ...modules].find(
        (file) => !existsSync(file)
      );
      if (missing !== undefined) throw new ScriptError(`No file ${missing}`, { exitCode: EXIT.usage });
      const document = runMigrate({
        cwd: process.cwd(),
        config,
        modules,
        ...choice,
        isWrite: options.write === true
      });
      io.stdout.write(isJson ? formatJson(document) : `${migrateText(document)}\n`);
      if (isMigrationPending(document))
        throw new ScriptError(document.summary, { exitCode: EXIT.failure, isReported: true });
    }
  })
});
