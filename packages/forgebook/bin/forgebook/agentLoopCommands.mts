/**
 * The commands of an agent's loop besides the answers: `agents` (the instructions a project's agents read), `check`
 * (the catalogue's checks on a story, in a browser), `errors` (what the open frames reported while it edited), `shot`
 * (a story's pictures, to look at it).
 *
 * @remarks
 * Defined here, on the scope `forgebook.mts` hands them, so the entry stays a list of commands; their work lives in
 * their own modules (`agentsText.ts`, `storyCheckRun.ts`, `errorsRun.ts`).
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson } from "@ensiria/cli-kit/files";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { type CatalogueClient, catalogueClient } from "./agentClient.ts";
import { agentsSkill, withAgentsSection } from "./agentsText.ts";
import { checkText, errorsOutput, shotText } from "./agentText.ts";
import { COMMAND, configOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { askErrors, followErrors, sinceOf } from "./errorsRun.ts";
import { runStoryCheck, runStoryShot } from "./storyCheckRun.ts";

/**
 * The catalogue the errors are asked of: only frames open in a browser report to a running dev server, so without one
 * there is nothing to list (said) and nothing ever to follow (refused).
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param isFollowing - whether the errors are followed.
 * @param log - the command's logger.
 */
const errorsClient = async (
  config: Awaited<ReturnType<typeof configOf>>,
  url: string | undefined,
  isFollowing: boolean,
  log: Logger
): Promise<CatalogueClient> => {
  const client = await catalogueClient(config, url);
  if (client.runningAt !== undefined) return client;
  if (isFollowing) {
    // nothing can ever report to a server of the command's own: following it would wait forever
    await client.close();
    throw new ScriptError("No catalogue running there to follow", {
      hint: `Start ${COMMAND} dev, then follow its errors (or give --url where it runs)`
    });
  }
  log.warn("No catalogue running there: only frames open in a browser report, so there is nothing to list");
  return client;
};

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const agentLoopCommands = (
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
      const config = await configOf(options.config);
      const report = await runStoryCheck(config, options.url, {
        id: args.id,
        views: options.view ?? [],
        isAllVariants: options["all-variants"] === true
      });
      if (typeof report === "string") throw new ScriptError(report);
      io.stdout.write(isJson ? formatJson(report) : `${checkText(report, style)}\n`);
      const problems = report.results.reduce((count, result) => count + result.problems.length, 0);
      if (problems > 0)
        throw new ScriptError(`${problems} problems`, { exitCode: EXIT.failure, isReported: true });
    }
  }),
  errors: forgebook.command({
    summary:
      "List what the open frames reported while you edited: stories that could not be shown, plays that failed.",
    json: true,
    options: {
      since: {
        type: "string",
        valueName: "n",
        description: "Only the errors after this number (the last answer's `last`)."
      },
      follow: { type: "boolean", description: "Keep listing new errors as they come, until stopped." },
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    examples: [
      {
        command: `${COMMAND} errors --json`,
        description: "The errors so far, and the story index's problems."
      },
      { command: `${COMMAND} errors --follow`, description: "New errors as you edit." }
    ],
    run: async ({ options, io, log, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const client = await errorsClient(config, options.url, options.follow === true, log);
      const since = sinceOf(options.since);
      try {
        if (options.follow === true) {
          // each new error once, as it comes: one JSON line each with --json
          const stopped = await followErrors(client.ask, since, (document) =>
            io.stdout.write(errorsOutput(document, { isJson, isFollowing: true }, style))
          );
          if (stopped !== undefined) throw new ScriptError(stopped);
          return;
        }
        const document = await askErrors(client.ask, since);
        if (typeof document === "string") throw new ScriptError(document);
        io.stdout.write(errorsOutput(document, { isJson, isFollowing: false }, style));
        for (const problem of document.problems) log.warn(problem);
        const count = document.errors.length + document.problems.length;
        if (count > 0)
          throw new ScriptError(`${count} errors and problems`, { exitCode: EXIT.failure, isReported: true });
      } finally {
        await client.close();
      }
    }
  }),
  shot: forgebook.command({
    summary: "Take a story's pictures in a browser, one PNG per view, to look at it.",
    json: true,
    options: {
      view: {
        type: "string",
        multiple: true,
        valueName: "view",
        description:
          'A view to picture it in: the address\'s form (theme=dark&width=360) or words ("dark it 360"); the default view when none.'
      },
      "all-variants": {
        type: "boolean",
        description: "Picture every variant the catalogue's browser tests check."
      },
      out: {
        type: "string",
        default: "forgebook-shots",
        valueName: "folder",
        description: "The folder the pictures go in."
      },
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
        command: `${COMMAND} shot kit:data-badge--default --view "dark 360"`,
        description: "Dark, 360 px wide."
      },
      {
        command: `${COMMAND} shot kit:data-badge --all-variants --json`,
        description: "Every story of a component in every variant, listed as JSON."
      }
    ],
    run: async ({ args, options, io, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const report = await runStoryShot(
        config,
        options.url,
        { id: args.id, views: options.view ?? [], isAllVariants: options["all-variants"] === true },
        resolve(options.out)
      );
      if (typeof report === "string") throw new ScriptError(report);
      io.stdout.write(
        isJson ? formatJson(report) : `${shotText(report, (file) => relative(process.cwd(), file), style)}\n`
      );
    }
  }),
  agents: forgebook.command({
    summary:
      "Add Forgebook's instructions for coding agents to the project's AGENTS.md: how to write and check stories.",
    options: {
      file: {
        type: "string",
        default: "AGENTS.md",
        valueName: "path",
        description: "The file the instructions go in; its other sections are left as they are."
      },
      skill: {
        type: "boolean",
        description: "Also write them as a Claude Code skill, .claude/skills/forgebook/SKILL.md."
      },
      print: { type: "boolean", description: "Print the instructions instead of writing them." }
    },
    examples: [
      { command: `${COMMAND} agents`, description: "Add or renew Forgebook's section of AGENTS.md." },
      { command: `${COMMAND} agents --skill`, description: "And the Claude Code skill." }
    ],
    run: ({ options, io, log }): void => {
      const section = readFileSync(new URL("./agents.md", import.meta.url), "utf8");
      if (options.print) {
        io.stdout.write(section);
        return;
      }
      const file = resolve(options.file);
      const isNew = !existsSync(file);
      writeFileSync(file, withAgentsSection(isNew ? undefined : readFileSync(file, "utf8"), section));
      log.success(`${relative(process.cwd(), file)}: Forgebook's section ${isNew ? "written" : "renewed"}`);
      if (options.skill !== true) return;
      const skill = resolve(".claude", "skills", "forgebook", "SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(skill, agentsSkill(section));
      log.success(`${relative(process.cwd(), skill)} written`);
    }
  })
});
