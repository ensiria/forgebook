/**
 * `forgebook mcp`: the catalogue's tools for agents over the Model Context Protocol, from a dev server or from a built
 * catalogue's index.
 *
 * @module
 */
import { resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { readPackageVersion } from "@ensiria/cli-kit/files";

import { catalogueClient } from "./agentClient.ts";
import { builtCatalogueServer, serveMcp } from "./builtCatalogue.ts";
import { COMMAND, configOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { catalogueTools } from "./mcpTools.ts";
import { newStoriesFile } from "./newStoriesFile.ts";
import { SEMANTIC_OPTIONS, semanticModelOf } from "./semanticOptions.ts";
import { runPageCheck, runStoryCheck, runStoryDiff, runStoryShot } from "./storyCheckRun.ts";
import { baselinesOf, visualDiffTool } from "./visualCommands.mts";

/**
 * The command.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const mcpCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  mcp: forgebook.command({
    summary:
      "Serve the catalogue's stories to an agent over the Model Context Protocol, on stdin and stdout.",
    header: false,
    options: {
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      },
      from: {
        type: "string",
        valueName: "address or folder",
        description: "A catalogue built with --agent-index: read-only, with no server and no repository."
      },
      ...SEMANTIC_OPTIONS
    },
    examples: [
      {
        command: `${COMMAND} mcp`,
        description: "What an agent's MCP configuration runs (npx forgebook mcp)."
      },
      {
        command: `${COMMAND} mcp --from https://ui.example.com`,
        description: "A published library's catalogue, for a team that consumes it."
      }
    ],
    run: async ({ options, io, log }): Promise<void> => {
      if (options.from !== undefined) {
        const version = readPackageVersion(import.meta.dirname);
        await serveMcp(await builtCatalogueServer(options.from, version), io);
        return;
      }
      const config = await configOf(options.config);
      // kept for the server's life: an agent's questions in a row each answer at once
      const client = await catalogueClient(config, options.url);
      log.debug(
        client.runningAt === undefined ? "Answering from a server of its own" : `Asking ${client.runningAt}`
      );
      const server = {
        info: { name: "forgebook", version: readPackageVersion(import.meta.dirname) },
        instructions: `The stories of the Forgebook catalogue "${config.title}". list_stories finds a story's id, get_story gives its args and its component's props, story_address gives the links a person opens to see it. list_pages and get_page read its guides.`,
        tools: [
          visualDiffTool((input, outDir) =>
            runStoryDiff(config, options.url, input, {
              baselines: baselinesOf(config.dir),
              outDir
            })
          ),
          ...catalogueTools({
            ask: client.ask,
            writeNew: (file, exportName) =>
              newStoriesFile(resolve(config.dir, file), exportName, config.framework.name),
            check: (input) => runStoryCheck(config, options.url, input, semanticModelOf(options)),
            shot: (input, outDir) => runStoryShot(config, options.url, input, outDir),
            checkPage: (address) => runPageCheck(config, [address])
          })
        ]
      };
      await serveMcp(server, io);
      await client.close();
    }
  })
});
