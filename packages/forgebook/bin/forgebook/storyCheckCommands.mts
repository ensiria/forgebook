/**
 * `forgebook check`: the catalogue's checks on a story in a browser, with the model's judgement when asked.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import { checkText } from "./agentText.ts";
import { COMMAND, configWithStoriesOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { SEMANTIC_OPTIONS, semanticModelOf } from "./semanticOptions.ts";
import { runStoryCheck } from "./storyCheckRun.ts";

/**
 * The command.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const storyCheckCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  check: forgebook.command({
    summary: "Run the catalogue's checks on a story in a browser: accessibility, spills, overlays, errors.",
    json: true,
    options: {
      view: {
        type: "string",
        multiple: true,
        valueName: "query",
        description:
          "A view to check it in, as the catalogue's address writes it (theme=dark&width=360); the default view when none."
      },
      "all-variants": {
        type: "boolean",
        description: "Check every variant the catalogue's browser tests check."
      },
      semantic: {
        type: "boolean",
        description: "Also ask the configured model, sending it each story's tree and picture."
      },
      ...SEMANTIC_OPTIONS,
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    positionals: [
      { name: "id", description: "A story's id, or a component's for its listed stories.", required: true }
    ],
    examples: [
      {
        command: `${COMMAND} check kit:inputs-select--overview`,
        description: "One story, in the default view."
      },
      {
        command: `${COMMAND} check kit:inputs-select --view "theme=dark" --json`,
        description: "Every story of a component, in the dark theme, as JSON."
      }
    ],
    run: async ({ args, options, io, isJson, style }): Promise<void> => {
      const config = await configWithStoriesOf(options.config);
      const report = await runStoryCheck(
        config,
        options.url,
        {
          id: args.id,
          views: options.view ?? [],
          isAllVariants: options["all-variants"] === true,
          isSemantic: options.semantic === true
        },
        semanticModelOf(options)
      );
      if (typeof report === "string") throw new ScriptError(report);
      io.stdout.write(isJson ? formatJson(report) : `${checkText(report, style)}\n`);
      const problems = report.results.reduce((count, result) => count + result.problems.length, 0);
      if (problems > 0)
        throw new ScriptError(`${problems} problems`, { exitCode: EXIT.failure, isReported: true });
    }
  })
});
