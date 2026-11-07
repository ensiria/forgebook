/**
 * The MCP tool `verify`, answered as the command of the same name answers.
 *
 * @module
 */
import type { VerifyDocument } from "../../src/vite/agent.types.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { textOf } from "./mcpToolParts.ts";
import { isVerifyFailure, type VerifyInput } from "./verifyRun.ts";

/** Runs `verify`: the answer, or why it could not run. */
export type Verify = (input: VerifyInput) => Promise<VerifyDocument | string>;

/**
 * The tool.
 *
 * @param verify - runs it.
 */
export const verifyTool = (verify: Verify): McpTool => ({
  name: "verify",
  description:
    "Whether a change is done: call it before saying so. Every changed UI file must reach a story that ran; those stories run in every variant, with check_code on what the change adds. `verdict` is verified, partly-verified (`skipped` names what was not checked), nothing-to-verify (no UI file changed), not-verified (a UI file has no story that ran, with its `reason` and its `fix` when there is one, `notVerified` names a story still loading when its frame gave up, or `unseen` names a changed published component an agent cannot find or read, with its `fix`) or failed; the last two are errors. Needs @forgebook/testing and Playwright in the project.",
  inputSchema: {
    type: "object",
    properties: {
      since: {
        type: "string",
        description:
          "The commit to compare with, from where the branch left it, as origin/develop in a pull request; the default branch when none."
      },
      quick: { type: "boolean", description: "Only the default view of each story: faster, and said so." }
    },
    additionalProperties: false
  },
  call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
    const document = await verify({ since: textOf(args, "since"), isQuick: args["quick"] === true });
    if (typeof document === "string") return { structured: { error: document }, isError: true };
    return { structured: document, isError: isVerifyFailure(document) };
  }
});
