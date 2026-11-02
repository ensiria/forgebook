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

import type { StoryCheckReport } from "../../src/storyCheck.ts";
import type { ChangedStoriesDocument } from "../../src/vite/agent.types.ts";
import { isChangedStoriesDocument, isFoundComponentsDocument } from "../../src/vite/agentApi.ts";
import type { ResolvedConfig } from "../../src/vite/configFile.ts";
import { type CatalogueClient, catalogueClient } from "./agentClient.ts";
import { agentsSkill, SKILL_FOLDERS, withAgentsSection } from "./agentsText.ts";
import { checkText, errorsOutput, foundComponentsText, shotText } from "./agentText.ts";
import { askCatalogue, COMMAND, configOf, type ForgebookOptions, printAnswer } from "./catalogueCommands.ts";
import { runCheckCode } from "./checkCodeRun.ts";
import { askErrors, followErrors, sinceOf } from "./errorsRun.ts";
import { runPageCheck, runStoryCheck, runStoryShot } from "./storyCheckRun.ts";
import { BASELINES_FOLDER, updateBaselines } from "./visualCommands.mts";

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

/** Where `forgebook dev` runs, for the commands that ask it. */
const URL_OPTION = {
  type: "string",
  env: "FORGEBOOK_URL",
  valueName: "address",
  description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
} as const;

/** The stories a change touches, as the catalogue answers. */
const changedOf = async (
  config: ResolvedConfig,
  options: { readonly since: string | undefined; readonly url: string | undefined },
  log: Logger
): Promise<ChangedStoriesDocument> => {
  const params = new URLSearchParams({ since: options.since ?? "" });
  const body = await askCatalogue(config, options.url, "changed", params, log);
  if (!isChangedStoriesDocument(body))
    throw new ScriptError("The catalogue's answer has an unexpected shape");
  return body;
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
  find: forgebook.command({
    summary: "Find components by what they are for, in your own words.",
    json: true,
    positionals: [{ name: "query", description: "What you are looking for.", required: true }],
    options: {
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    examples: [
      { command: `${COMMAND} find modal`, description: "Whatever this catalogue calls a modal." },
      { command: `${COMMAND} find "radio tile group" --json`, description: "As an agent asks." }
    ],
    run: async ({ options, args, io, log, isJson }): Promise<void> => {
      const config = await configOf(options.config);
      const params = new URLSearchParams({ query: args.query });
      const body = await askCatalogue(config, options.url, "find", params, log);
      if (!isFoundComponentsDocument(body)) {
        throw new ScriptError("The catalogue's answer has an unexpected shape");
      }
      printAnswer(foundComponentsText(body), body, [], { io, log, isJson });
    }
  }),
  changed: forgebook.command({
    summary: "List the stories a change touches, through what they import.",
    json: true,
    options: {
      since: {
        type: "string",
        valueName: "ref",
        description: "The commit to compare with; HEAD by default, so what is not committed."
      },
      url: URL_OPTION
    },
    examples: [
      { command: `${COMMAND} changed`, description: "What your uncommitted work touches." },
      { command: `${COMMAND} changed --since origin/develop --json`, description: "What a branch touches." }
    ],
    run: async ({ options, io, log, isJson }): Promise<void> => {
      const config = await configOf(options.config);
      const body = await changedOf(config, options, log);
      const text = body.stories.map((story) => story.id).join("\n");
      io.stdout.write(isJson ? formatJson(body) : `${text === "" ? "No story touched." : text}\n`);
    }
  }),
  verify: forgebook.command({
    summary: "Run the catalogue's checks on every story a change touches, with one exit code.",
    json: true,
    options: {
      since: {
        type: "string",
        valueName: "ref",
        description: "The commit to compare with; HEAD by default, so what is not committed."
      },
      url: URL_OPTION
    },
    examples: [
      { command: `${COMMAND} verify`, description: "Before you say a change is done." },
      { command: `${COMMAND} verify --since origin/develop --json`, description: "In a pull request." }
    ],
    run: async ({ options, io, log, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const { stories, files } = await changedOf(config, options, log);
      const reports: StoryCheckReport[] = [];
      for (const story of stories) {
        const report = await runStoryCheck(config, options.url, {
          id: story.id,
          views: [],
          isAllVariants: false
        });
        if (typeof report === "string") throw new ScriptError(report);
        reports.push(report);
      }
      const problems = reports
        .flatMap((report) => report.results)
        .reduce((sum, each) => sum + each.problems.length, 0);
      const text =
        reports.length === 0 ? "No story touched." : reports.map((each) => checkText(each, style)).join("\n");
      io.stdout.write(isJson ? formatJson({ schema: 1, files, stories, reports, problems }) : `${text}\n`);
      if (problems > 0)
        throw new ScriptError(`${problems} problems`, { exitCode: EXIT.failure, isReported: true });
    }
  }),
  "check-page": forgebook.command({
    summary: "Run the checks on a real page of the application: accessibility, what spills, its errors.",
    json: true,
    positionals: [{ name: "address", description: "The page's address.", required: true }],
    examples: [
      {
        command: `${COMMAND} check-page http://localhost:3000/checkout`,
        description: "The screen you built."
      }
    ],
    run: async ({ args, options, io, isJson, style }): Promise<void> => {
      const config = await configOf(options.config);
      const report = await runPageCheck(config, [args.address]);
      if (typeof report === "string") throw new ScriptError(report);
      io.stdout.write(isJson ? formatJson(report) : `${checkText(report, style)}\n`);
      const problems = report.results.reduce((count, result) => count + result.problems.length, 0);
      if (problems > 0)
        throw new ScriptError(`${problems} problems`, { exitCode: EXIT.failure, isReported: true });
    }
  }),
  "check-code": forgebook.command({
    summary: "Check what a change adds against the design system, with an exit code for CI.",
    json: true,
    options: {
      since: {
        type: "string",
        valueName: "ref",
        description: "The commit to compare with; HEAD by default, so what is not committed."
      },
      url: {
        type: "string",
        env: "FORGEBOOK_URL",
        valueName: "address",
        description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
      }
    },
    examples: [
      { command: `${COMMAND} check-code`, description: "Your uncommitted work." },
      {
        command: `${COMMAND} check-code --since origin/develop --json`,
        description: "A pull request, in CI."
      }
    ],
    run: async ({ options, io, log, isJson }): Promise<void> => {
      const config = await configOf(options.config);
      await runCheckCode({ config, url: options.url, context: { io, log, isJson } }, options.since);
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
      update: {
        type: "boolean",
        description: `Store them as the baselines forgebook diff compares with: ${BASELINES_FOLDER} beside the configuration, or --out.`
      },
      out: {
        type: "string",
        valueName: "folder",
        description: "The folder the pictures go in; forgebook-shots by default."
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
      const input = {
        id: args.id,
        views: options.view ?? [],
        isAllVariants: options["all-variants"] === true
      };
      const report =
        options.update === true
          ? await updateBaselines(config, options.url, input, options.out)
          : await runStoryShot(config, options.url, input, resolve(options.out ?? "forgebook-shots"));
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
        description: `Also write them as an Agent Skill, SKILL.md in ${SKILL_FOLDERS.join(" and ")}.`
      },
      print: { type: "boolean", description: "Print the instructions instead of writing them." }
    },
    examples: [
      { command: `${COMMAND} agents`, description: "Add or renew Forgebook's section of AGENTS.md." },
      { command: `${COMMAND} agents --skill`, description: "And the skill, for any agent." }
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
      for (const folder of SKILL_FOLDERS) {
        const skill = resolve(folder, "SKILL.md");
        mkdirSync(dirname(skill), { recursive: true });
        writeFileSync(skill, agentsSkill(section));
        log.success(`${relative(process.cwd(), skill)} written`);
      }
    }
  })
});
