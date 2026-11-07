/**
 * `forgebook graph`: a map of a project's components and tokens, generated from its source, for an agent to read instead of
 * everything. It needs no catalogue, and nothing of the project runs.
 *
 * @module
 */
import { resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";

import { type GraphDocument, graphDocument } from "../../src/vite/componentGraph.ts";
import { printable } from "./auditRun.ts";
import { COMMAND, type ForgebookOptions } from "./catalogueCommands.ts";

/** The map as a person reads it. */
const graphText = ({ total, components, intents, detail, tokens }: GraphDocument): string => {
  const choices = Object.entries(intents).flatMap(([id, list]) => [
    `${id}:`,
    ...list.map(({ component, when }) => `  ${component}${when === undefined ? "" : `: ${when}`}`)
  ]);
  const detailLines =
    detail === undefined
      ? []
      : [
          `${detail.name}  ${detail.at}`,
          `  renders: ${detail.renders.join(", ")}`,
          `  rendered by: ${detail.renderedBy.join(", ")}`,
          `  tokens: ${detail.tokens.join(", ")}`,
          ""
        ];
  const counts = Object.entries(tokens).map(([type, count]) => `${count} ${type}`);
  return [
    ...detailLines,
    ...choices,
    `${total} components, tokens: ${counts.join(", ") || "none"}.`,
    ...components.map(({ name, at, usedBy }) => `  ${name}  ${at}  used by ${usedBy}`)
  ].join("\n");
};

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const graphCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  graph: forgebook.command({
    summary:
      "Print a map of a project's components and tokens, generated from its source, for an agent to read.",
    json: true,
    positionals: [{ name: "folder", description: "The project's folder; the current one by default." }],
    options: {
      component: {
        type: "string",
        valueName: "name",
        description: "One component in detail, with those around it."
      },
      intent: {
        type: "string",
        valueName: "id",
        description: "Only the choices for one situation (`@intent`)."
      },
      limit: { type: "number", valueName: "n", description: "How many components to list; 100 by default." }
    },
    examples: [
      { command: `${COMMAND} graph --json`, description: "What exists and what each is for." },
      {
        command: `${COMMAND} graph --intent choose-one --json`,
        description: "How to choose among fixed patterns."
      },
      {
        command: `${COMMAND} graph --component Button --json`,
        description: "What renders it, what it renders, its tokens."
      }
    ],
    run: ({ positionals, options, io, isJson }): void => {
      const { limit } = options;
      if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
        throw new ScriptError("--limit takes a whole number above 0", { exitCode: EXIT.usage });
      }
      const document = graphDocument(resolve(positionals[0] ?? "."), {
        component: options.component,
        intent: options.intent,
        limit
      });
      io.stdout.write(isJson ? formatJson(document) : `${printable(graphText(document))}\n`);
    }
  })
});
