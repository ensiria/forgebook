/**
 * `forgebook check`: the catalogue's checks on a story in a browser, with the model's judgement when asked.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { checkText } from "./agentText.ts";
import { COMMAND, configWithStoriesOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { SEMANTIC_OPTIONS, semanticModelOf } from "./semanticOptions.ts";
import { runStoryCheck, runStoryStress } from "./storyCheckRun.ts";
import { isStressFailure, stressText } from "./stressText.ts";

/** What a stress run's printing reads. */
type StressOutput = {
  readonly config: ResolvedConfig;
  readonly url: string | undefined;
  readonly id: string;
  readonly io: { readonly stdout: { readonly write: (text: string) => unknown } };
  readonly log: { readonly warn: (text: string) => void };
  readonly isJson: boolean;
};

/** Refuses what `--stress` does not take: it chooses its own values and views. */
const refuseWithStress = (options: {
  readonly view?: readonly string[];
  readonly "all-variants"?: boolean;
  readonly semantic?: boolean;
}): void => {
  if ((options.view ?? []).length > 0 || options["all-variants"] === true || options.semantic === true)
    throw new ScriptError(
      "--stress chooses its own values and views: leave out --view, --all-variants and --semantic",
      {
        exitCode: EXIT.usage
      }
    );
};

/** Runs the stress matrix and prints it, failing when a case breaks what the plain story does not. */
const stressRun = async ({ config, url, id, io, log, isJson }: StressOutput): Promise<void> => {
  const stressed = await runStoryStress(config, url, id);
  if (typeof stressed === "string") throw new ScriptError(stressed);
  io.stdout.write(isJson ? formatJson(stressed) : `${stressText(stressed)}\n`);
  for (const each of isJson ? (stressed.skipped ?? []) : []) log.warn(each);
  if (isStressFailure(stressed))
    throw new ScriptError("A case breaks what the plain story does not", {
      exitCode: EXIT.failure,
      isReported: true
    });
};

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
      stress: {
        type: "boolean",
        description:
          "Draw it with worst-case values and views it never declared (long text, unbreakable words, huge numbers, empty, right to left, 200 % zoom, narrow, dark, more contrast), with no story written, and report what each breaks that the plain story does not."
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
      },
      {
        command: `${COMMAND} check kit:inputs-select--overview --stress --json`,
        description: "The states nobody wrote a story for."
      }
    ],
    run: async ({ args, options, io, log, isJson, style }): Promise<void> => {
      const config = await configWithStoriesOf(options.config);
      if (options.stress === true) {
        refuseWithStress(options);
        await stressRun({ config, url: options.url, id: args.id, io, log, isJson });
        return;
      }
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
      const notVerified = report.results.filter((result) => result.notVerified !== undefined).length;
      if (notVerified > 0)
        throw new ScriptError(`${notVerified} not verified`, { exitCode: EXIT.failure, isReported: true });
    }
  })
});
