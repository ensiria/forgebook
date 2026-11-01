#!/usr/bin/env node
/**
 * The `forgebook` command: runs a catalogue from its `forgebook.config.ts` (`dev`, the dev server) or builds it into
 * static files (`build`), with no page or Vite configuration of the app's own; answers tools and agents with what the
 * catalogue shows (`stories`, `story`, `mcp`); and writes what a project keeps (`docs`, `new`, `agents`).
 *
 * @module
 */
import { existsSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createInterface } from "node:readline";

import { defineCommands } from "@ensiria/cli-kit/commands";
import { readPackageVersion } from "@ensiria/cli-kit/files";
import { ScriptError } from "@ensiria/cli-kit/script";
import { build, createServer } from "vite";

import {
  filteredStories,
  isFoundComponentsDocument,
  isStoriesDocument,
  isStoryDocument
} from "../../src/vite/agentApi.ts";
import { answerMcpMessage, NEW_SESSION } from "../../src/vite/mcpProtocol.ts";
import { catalogueDocs } from "../forgebook-docs/catalogueDocs.ts";
import type { CatalogueDocsReport } from "../forgebook-docs/catalogueDocs.types.ts";
import { catalogueClient } from "./agentClient.ts";
import { agentLoopCommands } from "./agentLoopCommands.mts";
import { foundComponentsText, storiesText, storyText } from "./agentText.ts";
import { askCatalogue, COMMAND, configOf, FORGEBOOK_OPTIONS, printAnswer } from "./catalogueCommands.ts";
import { catalogueVite } from "./catalogueVite.ts";
import { initCommands } from "./initCommands.mts";
import { catalogueTools } from "./mcpTools.ts";
import { newStoriesFile } from "./newStoriesFile.ts";
import { runStoryCheck, runStoryShot } from "./storyCheckRun.ts";
import { openTouchWindow } from "./touchWindowRun.ts";

await defineCommands({
  name: "forgebook",
  command: COMMAND,
  summary:
    "Run a catalogue of stories from its forgebook.config.ts, build it, or answer tools and agents about it.",
  icon: "docs",
  options: FORGEBOOK_OPTIONS,
  commands: (forgebook) => ({
    dev: forgebook.command({
      summary: "Run the catalogue's dev server.",
      options: {
        port: {
          type: "string",
          valueName: "number",
          description: "The port to listen on; Vite's by default."
        },
        host: {
          type: "string",
          valueName: "address",
          description: "The address to listen on; localhost by default."
        },
        force: {
          type: "boolean",
          description: "Pre-bundle the dependencies again, ignoring Vite's cache (as a first start does)."
        },
        touch: {
          type: "boolean",
          description:
            "Also open the catalogue in a Chromium window with Chromium's own touch emulation: the mouse makes real " +
            "touch events, native scrolling included (needs @forgebook/testing and Playwright). Still a computer: no " +
            "virtual keyboard, no iOS Safari; a device remains the last word."
        }
      },
      examples: [
        { command: `${COMMAND} dev`, description: "Run the catalogue of the folder you are in." },
        { command: `${COMMAND} dev --port 6006`, description: "On a given port." },
        { command: `${COMMAND} dev --touch`, description: "And try the stories with Chromium's real touch." }
      ],
      run: async ({ options, onInterrupt, log }): Promise<void> => {
        const config = await configOf(options.config);
        const port = options.port === undefined ? undefined : Number(options.port);
        if (port !== undefined && !Number.isInteger(port))
          throw new ScriptError(`--port ${options.port} is not a port`);
        const server = await createServer(
          await catalogueVite(config, {
            server: {
              ...(port === undefined ? {} : { port, strictPort: true }),
              ...(options.host === undefined ? {} : { host: options.host })
            },
            ...(options.force === true ? { optimizeDeps: { force: true } } : {})
          })
        );
        await server.listen();
        server.printUrls();
        if (options.touch === true) await openTouchWindow(config.dir, server.resolvedUrls?.local[0], log);
        await new Promise<void>((done) => {
          onInterrupt(() => {
            void server.close().then(done);
          });
        });
      }
    }),
    build: forgebook.command({
      summary: "Build the catalogue into static files.",
      options: {
        out: { type: "string", valueName: "folder", description: "The folder to write; dist by default." }
      },
      examples: [{ command: `${COMMAND} build --out site`, description: "Build it into static files." }],
      run: async ({ options, log }): Promise<void> => {
        const config = await configOf(options.config);
        await build(
          await catalogueVite(config, { build: { outDir: resolve(config.dir, options.out ?? "dist") } })
        );
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
        const config = await configOf(options.config);
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
        if (!isFoundComponentsDocument(body))
          throw new ScriptError("The catalogue's answer has an unexpected shape");
        printAnswer(foundComponentsText(body), body, [], { io, log, isJson });
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
      run: ({ options, log }): Promise<CatalogueDocsReport> =>
        catalogueDocs(
          {
            packageDir: resolve(options.package),
            framework: options.framework,
            isCheck: options.check,
            fixCommand: `${COMMAND} docs`
          },
          log
        )
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
          default: "react",
          valueName: "name",
          description:
            "The framework the stories are written for: its package, @forgebook/<name>, reads the props."
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
    ...initCommands(forgebook),
    mcp: forgebook.command({
      summary:
        "Serve the catalogue's stories to an agent over the Model Context Protocol, on stdin and stdout.",
      header: false,
      options: {
        url: {
          type: "string",
          env: "FORGEBOOK_URL",
          valueName: "address",
          description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
        }
      },
      examples: [
        {
          command: `${COMMAND} mcp`,
          description: "What an agent's MCP configuration runs (npx forgebook mcp)."
        }
      ],
      run: async ({ options, io, log }): Promise<void> => {
        const config = await configOf(options.config);
        // kept for the server's life: an agent's questions in a row each answer at once
        const client = await catalogueClient(config, options.url);
        log.debug(
          client.runningAt === undefined ? "Answering from a server of its own" : `Asking ${client.runningAt}`
        );
        const server = {
          info: { name: "forgebook", version: readPackageVersion(import.meta.dirname) },
          instructions: `The stories of the Forgebook catalogue "${config.title}". list_stories finds a story's id, get_story gives its args and its component's props, story_address gives the links a person opens to see it.`,
          tools: catalogueTools({
            ask: client.ask,
            writeNew: (file, exportName) =>
              newStoriesFile(resolve(config.dir, file), exportName, config.framework.name),
            check: (input) => runStoryCheck(config, options.url, input),
            shot: (input, outDir) => runStoryShot(config, options.url, input, outDir)
          })
        };
        let session = NEW_SESSION;
        // stdout carries only the protocol's messages, one per line, answered in the order they came
        for await (const line of createInterface({ input: io.stdin })) {
          if (line.trim() === "") continue;
          const step = await answerMcpMessage(line, session, server);
          session = step.session;
          if (step.reply !== undefined) io.stdout.write(`${step.reply}\n`);
        }
        await client.close();
      }
    }),
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
        }
      ],
      run: async ({ args, options, io, log, isJson, style }): Promise<void> => {
        const config = await configOf(options.config);
        const params = new URLSearchParams({ id: args.id, view: options.view ?? "" });
        const body = await askCatalogue(config, options.url, "story", params, log);
        if (!isStoryDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
        printAnswer(storyText(body, style), body, body.problems, { io, log, isJson });
      }
    })
  })
}).run();
