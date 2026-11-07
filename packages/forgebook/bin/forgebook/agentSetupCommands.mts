/**
 * The commands a project's coding agents are set up with: `hook`, which an assistant runs when it is about to finish, and
 * `browser`, which installs what the stories' checks run on.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { emptyStoryGlobsProblems } from "../../src/vite/emptyStoryGlobs.ts";
import { catalogueClient } from "./agentClient.ts";
import { ASSISTANT_NAMES, type AssistantName } from "./agentSetup/assistantHooks.ts";
import {
  allowed,
  answerToVerdict,
  type HookAnswer,
  isContinuing,
  isTurnAborted,
  sayAnswer,
  touchesUi
} from "./agentSetup/stopHook.ts";
import { verifyText } from "./agentText.ts";
import { COMMAND, configOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { runStoriesCheck } from "./storyCheckRun.ts";
import { runVerify } from "./verifyRun.ts";

/** What an assistant sent on stdin: empty when nothing is piped in, as when a person runs the command. */
const hookInput = async (): Promise<string> => {
  if (process.stdin.isTTY) return "";
  const chunks: string[] = [];
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) if (typeof chunk === "string") chunks.push(chunk);
  return chunks.join("");
};

/** Runs `verify` for a hook; anything but a verdict lets the assistant finish, since it cannot repair a hook. */
const hookAnswer = async (
  assistant: AssistantName,
  input: string,
  configFile: string | undefined,
  url: string | undefined,
  style: Parameters<typeof verifyText>[1]
): Promise<HookAnswer> => {
  if (isTurnAborted(input)) return allowed();
  try {
    // a pattern that matches nothing leaves the verdict not verified, with the rest of it: never no verdict at all
    const config = await configOf(configFile);
    if (!(await touchesUi(config.dir))) return allowed();
    const client = await catalogueClient(config, url);
    try {
      const document = await runVerify(
        { dir: config.dir, ask: client.ask, check: (each) => runStoriesCheck(config, url, each) },
        { since: undefined, isQuick: false, configProblems: emptyStoryGlobsProblems(config) }
      );
      if (typeof document === "string") return allowed(`forgebook verify could not run: ${document}\n`);
      const text = verifyText(document, style);
      return answerToVerdict(assistant, document, text, config.dir, isContinuing(input));
    } finally {
      await client.close();
    }
  } catch (error) {
    return allowed(
      `forgebook verify could not run: ${error instanceof Error ? error.message : String(error)}\n`
    );
  }
};

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const agentSetupCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  hook: forgebook.command({
    header: false,
    summary:
      "What an assistant's hook runs when it is about to finish: verify on the change, sending the agent back on red. Written by init --agents.",
    options: {
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    positionals: [
      { name: "assistant", description: `The assistant: ${ASSISTANT_NAMES.join(", ")}.`, required: true }
    ],
    examples: [{ command: `${COMMAND} hook claude`, description: "As Claude Code's Stop hook runs it." }],
    run: async ({ args, options, io, style }): Promise<void> => {
      const assistant = ASSISTANT_NAMES.find((name) => name === args.assistant);
      if (assistant === undefined)
        throw new ScriptError(`No hook format for ${args.assistant}`, {
          hint: `It takes ${ASSISTANT_NAMES.join(", ")}`
        });
      const input = await hookInput();
      // what the server logs (a story's errors, in the project's words) would reach the agent as if the hook said it
      const { write } = process.stderr;
      Object.assign(process.stderr, { write: (): boolean => true });
      const answer = await hookAnswer(assistant, input, options.config, options.url, style).finally(() => {
        Object.assign(process.stderr, { write });
      });
      sayAnswer(answer, io);
    }
  }),
  browser: forgebook.command({
    summary: "Install the browser the stories' checks run on, with the Playwright that will open it.",
    options: {
      "with-deps": {
        type: "boolean",
        description: "Also install what the browser needs of the system, as CI does."
      }
    },
    examples: [{ command: `${COMMAND} browser`, description: "Once, after installing @forgebook/testing." }],
    run: async ({ options, io, log }): Promise<void> => {
      const { installBrowser } = await import("./browserRun.ts");
      await installBrowser(process.cwd(), options["with-deps"] === true, io);
      log.success("Browser installed");
    }
  })
});
