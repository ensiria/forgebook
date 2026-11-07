/**
 * `forgebook audit`: the values and components a project actually uses, with no catalogue and no configuration.
 *
 * @module
 */
import { resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import { parsedColor } from "../../src/vite/nearestToken.ts";
import { auditDocument, auditSitesDocument, auditText, printable } from "./auditRun.ts";
import { COMMAND, type ForgebookOptions } from "./catalogueCommands.ts";

/** A list's limit, when it can be one. */
const checkedLimit = (limit: number | undefined): number | undefined => {
  if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
    throw new ScriptError("--limit takes a whole number above 0", { exitCode: EXIT.usage });
  }
  return limit;
};

/** A value to look for, when it can be read: a word that is neither would answer that it is not there. */
const checkedValue = (value: string): string => {
  if (parsedColor(value) === undefined && !/^-?\d*\.?\d+(?:px|rem)?$/.test(value)) {
    throw new ScriptError(`Cannot read "${value}" as a colour or a size: write it as code does`, {
      exitCode: EXIT.usage
    });
  }
  return value;
};

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const auditCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  audit: forgebook.command({
    summary: "Report the colours, sizes and components a project actually uses, with what to do next.",
    json: true,
    positionals: [{ name: "folder", description: "The project's folder; the current one by default." }],
    options: {
      value: {
        type: "string",
        valueName: "value",
        description: "List where this value is written by hand, instead of the report."
      },
      limit: {
        type: "number",
        valueName: "n",
        description: "How many values each list gives; 10 by default."
      }
    },
    examples: [
      { command: `${COMMAND} audit`, description: "What this project uses." },
      {
        command: `${COMMAND} audit --json`,
        description: "The same with `actions`, the next steps, for an agent."
      },
      {
        command: `${COMMAND} audit --value "#64748b" --json`,
        description: "Every place to edit for one of them."
      }
    ],
    run: ({ positionals, options, io, isJson }): void => {
      const dir = resolve(positionals[0] ?? ".");
      if (options.value === undefined) {
        const document = auditDocument(dir, checkedLimit(options.limit), positionals[0] ?? ".");
        io.stdout.write(isJson ? formatJson(document) : `${printable(auditText(document))}\n`);
        return;
      }
      const found = auditSitesDocument(dir, checkedValue(options.value));
      const lines = found.sites.map(({ file, line, text }) => `${file}:${line}  ${text}`);
      const text = printable(lines.join("\n")) || `${options.value} is not written by hand.`;
      io.stdout.write(isJson ? formatJson(found) : `${text}\n`);
    }
  })
});
