/**
 * `forgebook guide`: the rest of what `forgebook agents` leaves out of a project's files, printed a topic at a time.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { formatJson } from "@ensiria/cli-kit/files";
import { table } from "@ensiria/cli-kit/layout";
import { ScriptError } from "@ensiria/cli-kit/script";

import { guideList, guideTopic, projectFrameworks } from "./agentGuide.ts";
import { COMMAND, configPathOf, type ForgebookOptions } from "./catalogueCommands.ts";

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const guideCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
  guide: forgebook.command({
    summary: "Print Forgebook's guide for coding agents: a framework's or a topic's full text, on demand.",
    json: true,
    positionals: [{ name: "topic", description: "The topic or the framework; none lists them." }],
    examples: [
      { command: `${COMMAND} guide`, description: "The topics, and this project's framework." },
      { command: `${COMMAND} guide vue`, description: "Stories in Vue." },
      { command: `${COMMAND} guide docs-pages`, description: "Writing a docs page." }
    ],
    run: ({ args, options, io, isJson, style }): void => {
      if (args.topic === undefined) {
        const frameworks = projectFrameworks(configPathOf(options.config), process.cwd());
        const list = guideList(frameworks);
        const about = table(
          list.topics.map((each) => [each.topic, each.about]),
          { columns: [{ header: "Topic" }, { header: "What it holds" }] },
          style
        );
        const found = frameworks.length === 0 ? "" : `\n\nThis project: ${frameworks.join(", ")}`;
        io.stdout.write(isJson ? formatJson(list) : `${about}${found}\n`);
        return;
      }
      const topic = guideTopic(args.topic);
      if (topic === undefined) {
        throw new ScriptError(`No topic ${args.topic}`, { hint: `${COMMAND} guide lists them` });
      }
      io.stdout.write(isJson ? formatJson(topic) : `${topic.text}\n`);
    }
  })
});
