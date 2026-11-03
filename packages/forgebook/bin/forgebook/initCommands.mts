/**
 * The command that starts a catalogue: `init --from storybook` writes `forgebook.config.ts` from a project's Storybook
 * files, so a project on Storybook tries Forgebook in one command, its stories read as they are.
 *
 * @remarks
 * Defined here, on the scope `forgebookCommands.mts` hands it, so the commands module stays a list of commands; the reading is the
 * importer's (`importers/storybook.ts`), the writing `initConfig.ts`'s. A configuration already there is never
 * replaced unless asked (`--force`): it may hold a person's work.
 *
 * @module
 */
import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { CONFIG_FILES } from "../../src/vite/configFile.ts";
import { COMMAND, type ForgebookOptions } from "./catalogueCommands.ts";
import type { ImportedConfig } from "./importers/storybook.ts";
import { frameworkPeers } from "./importers/storybookFrameworks.ts";
import { CONFIG_FILE, initConfigText } from "./initConfig.ts";

/**
 * The modules the written configuration needs, by the package that has each: what it imports, and the framework's
 * peers.
 *
 * @param imported - what the importer read: the framework and its options.
 */
const configImports = (
  imported: Pick<ImportedConfig, "framework" | "frameworkOptions">
): Readonly<Record<string, string>> => ({
  forgebook: "forgebook",
  [`@forgebook/${imported.framework}`]: `@forgebook/${imported.framework}/vite`,
  ...Object.fromEntries(
    frameworkPeers(imported.framework, imported.frameworkOptions).map((peer) => [
      peer,
      `${peer}/package.json`
    ])
  )
});

/**
 * The packages the written configuration needs that the project cannot load yet.
 *
 * @param dir - the project's folder.
 * @param imported - what the importer read: the framework and its options.
 */
const missingPackages = (
  dir: string,
  imported: Pick<ImportedConfig, "framework" | "frameworkOptions">
): string[] => {
  const require = createRequire(join(dir, "package.json"));
  return Object.entries(configImports(imported)).flatMap(([name, specifier]) => {
    try {
      require.resolve(specifier);
      return [];
    } catch {
      return [name];
    }
  });
};

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
      "Write forgebook.config.ts from another tool's files: Storybook's story globs, preview and globals.",
    options: {
      from: {
        type: "string",
        required: true,
        choices: ["storybook"],
        valueName: "tool",
        description:
          "The tool whose files are read (its folder in the current one: .storybook, or on-device Storybook's .rnstorybook)."
      },
      force: { type: "boolean", description: `Replace a ${CONFIG_FILE} that is already there.` }
    },
    examples: [
      {
        command: `${COMMAND} init --from storybook`,
        description: "Read .storybook and write the configuration."
      }
    ],
    run: async ({ options, log }): Promise<void> => {
      const file = resolve(CONFIG_FILE);
      // any configuration the catalogue would read, not only the file written: a new .ts would win over a .mts
      const existing = CONFIG_FILES.find((name) => existsSync(resolve(name)));
      if (existing !== undefined && options.force !== true)
        throw new ScriptError(`${existing} is already there`, {
          hint: "Give --force to replace it with the one read from Storybook"
        });
      // the importer reads Storybook's files with the compiler: only this command loads it
      const { importStorybook } = await import("./importers/storybook.ts");
      const imported = await importStorybook(process.cwd());
      if (typeof imported === "string") throw new ScriptError(imported);
      writeFileSync(file, initConfigText(imported, "Storybook"));
      log.success(`${CONFIG_FILE} written: ${imported.stories.length} story globs`);
      for (const note of imported.notes) log.warn(note);
      const missing = missingPackages(process.cwd(), imported);
      if (missing.length > 0)
        log.info(`Install what it imports first: npm install --save-dev ${missing.join(" ")}`);
      log.info(
        `Next: ${COMMAND} dev to open the catalogue, ${COMMAND} stories to list what did not read, ` +
          `${COMMAND} agents for the project's coding agents`
      );
    }
  })
});
