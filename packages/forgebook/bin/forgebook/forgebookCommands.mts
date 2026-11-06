/**
 * The `forgebook` command's commands, loaded by its entry (`forgebook.mts`): runs a catalogue from its
 * `forgebook.config.ts` (`dev`, the dev server) or builds it into static files (`build`), with no page or Vite
 * configuration of the app's own; answers tools and agents with what the catalogue shows (`stories`, `story`, `mcp`);
 * and writes what a project keeps (`docs`, `new`, `agents`).
 *
 * @remarks
 * What only one command needs and weighs (the compiler, the Markdown reader, the Storybook importer) is imported by
 * that command when it runs, so `forgebook dev` starts without it.
 *
 * @module
 */
import { existsSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { defineCommands } from "@ensiria/cli-kit/commands";
import { ScriptError } from "@ensiria/cli-kit/script";
import { build } from "vite";

import { filteredStories, isStoriesDocument, isStoryDocument } from "../../src/vite/agentApi.ts";
import type { CatalogueDocsReport } from "../forgebook-docs/catalogueDocs.types.ts";
import { agentLoopCommands } from "./agentLoopCommands.mts";
import { storiesText, storyText } from "./agentText.ts";
import { buildFailureText } from "./buildFailure.ts";
import { settleAgentIndex } from "./builtCatalogue.ts";
import {
  askCatalogue,
  COMMAND,
  configOf,
  configWithStoriesOf,
  FORGEBOOK_OPTIONS,
  printAnswer
} from "./catalogueCommands.ts";
import { catalogueVite, withReadableNames } from "./catalogueVite.ts";
import { devCommands } from "./devCommands.mts";
import { guideCommands } from "./guideCommand.mts";
import { initCommands } from "./initCommands.mts";
import { mcpCommands } from "./mcpCommand.mts";
import { newStoriesFile } from "./newStoriesFile.ts";
import { pagesCommands } from "./pagesCommands.mts";
import { runTokens } from "./tokensRun.ts";
import { visualCommands } from "./visualCommands.mts";

await defineCommands({
  name: "forgebook",
  command: COMMAND,
  summary:
    "Run a catalogue of stories from its forgebook.config.ts, build it, or answer tools and agents about it.",
  icon: "docs",
  options: FORGEBOOK_OPTIONS,
  commands: (forgebook) => ({
    ...devCommands(forgebook),
    build: forgebook.command({
      summary: "Build the catalogue into static files.",
      options: {
        out: { type: "string", valueName: "folder", description: "The folder to write; dist by default." },
        base: {
          type: "string",
          valueName: "path",
          description: "The path the catalogue is served under (/pr-12/); the root by default."
        },
        "agent-index": {
          type: "boolean",
          description: "Also write what agents read, for forgebook mcp --from: props, docs, tokens, public."
        },
        "readable-names": {
          type: "boolean",
          description:
            "Name each script after its module as well as its hash (build.readableNames in the configuration)."
        }
      },
      examples: [
        { command: `${COMMAND} build --out site`, description: "Build it into static files." },
        {
          command: `${COMMAND} build --base /pr-12/`,
          description: "For a host that serves it under a sub-path."
        }
      ],
      run: async ({ options, log }): Promise<void> => {
        const config = withReadableNames(
          await configWithStoriesOf(options.config),
          options["readable-names"]
        );
        const outDir = resolve(config.dir, options.out ?? "dist");
        const vite = await catalogueVite(config, {
          ...(options.base === undefined ? {} : { base: options.base }),
          build: { outDir }
        });
        try {
          await build(vite);
        } catch (error) {
          if (error instanceof Error && error.stack !== undefined) log.debug(error.stack);
          throw new ScriptError(buildFailureText(error));
        }
        await settleAgentIndex(config, outDir, options["agent-index"] === true, log);
        log.success(`${config.title} built`);
      }
    }),
    stories: forgebook.command({
      summary: "List the catalogue's stories, with their ids and links; fail when the index has problems.",
      json: true,
      options: {
        source: { type: "string", valueName: "id", description: "Only this source's stories." },
        component: {
          type: "string",
          valueName: "text",
          description: "Only components whose title holds this text."
        },
        view: {
          type: "string",
          valueName: "query",
          description:
            "The view the links open in, as the catalogue's address writes it (theme=dark&lang=it)."
        },
        "used-in": {
          type: "boolean",
          description:
            "Add each component's \"Used in\": the components whose stories use it (reads the package's import graph)."
        },
        url: {
          type: "string",
          env: "FORGEBOOK_URL",
          valueName: "address",
          description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
        }
      },
      examples: [
        { command: `${COMMAND} stories`, description: "Every story." },
        {
          command: `${COMMAND} stories --component select --used-in --json`,
          description: "The selects, with the components whose stories use them."
        },
        { command: `${COMMAND} stories --component button --json`, description: "The buttons, as JSON." }
      ],
      run: async ({ options, io, log, isJson, style }): Promise<void> => {
        const config = await configWithStoriesOf(options.config);
        const params = new URLSearchParams({
          view: options.view ?? "",
          usedIn: String(options["used-in"] === true)
        });
        const body = await askCatalogue(config, options.url, "stories", params, log);
        if (!isStoriesDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
        const document = filteredStories(body, { source: options.source, component: options.component });
        printAnswer(storiesText(document, style), document, document.problems, { io, log, isJson });
      }
    }),
    tokens: forgebook.command({
      summary:
        "List the catalogue's design tokens, show one, or find the one nearest a value written by hand.",
      json: true,
      positionals: [{ name: "name", description: "A token's name, to see that one." }],
      options: {
        category: {
          type: "string",
          valueName: "name",
          description: "Only a token type (color) or a first group (space)."
        },
        nearest: {
          type: "string",
          valueName: "value",
          description: "The tokens nearest this value, as code writes it: #1c1b1b, 16px, 200ms."
        },
        type: {
          type: "string",
          valueName: "type",
          description:
            "With --nearest, what to compare with: color, dimension, duration, number, fontWeight, or a CSS property; read from the value when left out."
        },
        limit: {
          type: "string",
          valueName: "number",
          description: "The most tokens a list gives; 100 by default, with the total beside them."
        },
        url: {
          type: "string",
          env: "FORGEBOOK_URL",
          valueName: "address",
          description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
        }
      },
      examples: [
        { command: `${COMMAND} tokens --category color`, description: "Every colour." },
        { command: `${COMMAND} tokens color.brand.primary --json`, description: "One token." },
        {
          command: `${COMMAND} tokens --nearest "#1c1b1b"`,
          description: "What to write instead of that colour."
        },
        {
          command: `${COMMAND} tokens --nearest 13px --type dimension`,
          description: "And instead of that size."
        }
      ],
      run: async ({ options, args, io, log, isJson }): Promise<void> => {
        const config = await configOf(options.config);
        const { nearest, category, type, limit, url } = options;
        await runTokens(
          { config, url, context: { io, log, isJson } },
          { name: args.name, nearest, category, type, limit }
        );
      }
    }),
    docs: forgebook.command({
      summary:
        "Write a package's CATALOG.md and llms.txt, for agents writing code with it; --check fails when stale.",
      json: true,
      options: {
        package: {
          type: "string",
          default: ".",
          valueName: "folder",
          description: "The package's folder; the current folder by default."
        },
        framework: {
          type: "string",
          default: "react",
          valueName: "name",
          description:
            "The framework the stories are written for: its package, @forgebook/<name>, reads the props."
        },
        check: {
          type: "boolean",
          short: "c",
          description: "Change nothing; fail when a file is stale or a file cannot be read (CI)."
        }
      },
      examples: [
        {
          command: `${COMMAND} docs`,
          description: "Rewrite the CATALOG.md and llms.txt of the package you are in."
        },
        { command: `${COMMAND} docs --check`, description: "Check them in CI." }
      ],
      run: async ({ options, log }): Promise<CatalogueDocsReport> => {
        // the docs writer loads the compiler and the Markdown reader: only this command needs them
        const { catalogueDocs } = await import("../forgebook-docs/catalogueDocs.ts");
        return catalogueDocs(
          {
            packageDir: resolve(options.package),
            framework: options.framework,
            isCheck: options.check,
            fixCommand: `${COMMAND} docs`
          },
          log
        );
      }
    }),
    new: forgebook.command({
      summary:
        "Write a component's first stories from its props: the main story, one per choice, the worst case.",
      options: {
        export: {
          type: "string",
          valueName: "name",
          description: "The component to read; the file's only one by default."
        },
        framework: {
          type: "string",
          valueName: "name",
          description:
            "The framework the stories are written for: its package, @forgebook/<name>, reads the props. The catalogue's by default, else react."
        },
        print: { type: "boolean", description: "Print the file instead of writing it." },
        force: { type: "boolean", description: "Replace a stories file that exists." }
      },
      positionals: [{ name: "file", description: "The component's file.", required: true }],
      examples: [
        { command: `${COMMAND} new src/Badge.tsx`, description: "Write src/Badge.stories.tsx." },
        {
          command: `${COMMAND} new src/menu.tsx --export Menu --print`,
          description: "One of several, printed."
        }
      ],
      run: async ({ args, options, io, log }): Promise<void> => {
        const written = await newStoriesFile(resolve(args.file), options.export, options.framework);
        if (options.print) {
          io.stdout.write(written.text);
          return;
        }
        const shown = relative(process.cwd(), written.file);
        if (existsSync(written.file) && options.force !== true)
          throw new ScriptError(`${shown} exists`, {
            hint: "Give --force to replace it, or --print to see it"
          });
        writeFileSync(written.file, written.text);
        log.success(`${shown} written`);
        log.info(
          `${COMMAND} stories --component ${written.text.match(/title: "([^"]*)"/)?.[1] ?? ""} lists them`
        );
      }
    }),
    ...agentLoopCommands(forgebook),
    ...guideCommands(forgebook),
    ...pagesCommands(forgebook),
    ...visualCommands(forgebook),
    ...initCommands(forgebook),
    ...mcpCommands(forgebook),
    story: forgebook.command({
      summary:
        "One story in detail: its args, its component's props, its links; fail when it cannot be read.",
      json: true,
      options: {
        view: {
          type: "string",
          valueName: "query",
          description:
            "The view the links open in, as the catalogue's address writes it (theme=dark&lang=it)."
        },
        args: {
          type: "string",
          valueName: "json",
          description:
            "Values to set, as JSON: checked as a link's are, against `controls`; the links carry those taken, and a value left out fails the command."
        },
        url: {
          type: "string",
          env: "FORGEBOOK_URL",
          valueName: "address",
          description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
        }
      },
      positionals: [
        { name: "id", description: "The story's id, as forgebook stories lists it.", required: true }
      ],
      examples: [
        {
          command: `${COMMAND} story kit:actions-button--primary --view theme=dark --json`,
          description: "A story, its links in the dark theme, as JSON."
        },
        {
          command: `${COMMAND} story kit:forms-select--overview --args '{"tags":["a","b"]}' --json`,
          description: "The links that open a story with these values, once checked."
        }
      ],
      run: async ({ args, options, io, log, isJson, style }): Promise<void> => {
        const config = await configOf(options.config);
        const params = new URLSearchParams({
          id: args.id,
          view: options.view ?? "",
          ...(options.args === undefined ? {} : { args: options.args })
        });
        const body = await askCatalogue(config, options.url, "story", params, log);
        if (!isStoryDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
        printAnswer(storyText(body, style), body, body.problems, { io, log, isJson });
      }
    })
  })
}).run();
