#!/usr/bin/env node
/**
 * The `forgebook` command: runs a catalogue from its `forgebook.config.ts` (`dev`, the dev server) or builds it into
 * static files (`build`), with no page or Vite configuration of the app's own; and answers tools and agents
 * (`stories`, `story`) with what the catalogue shows.
 *
 * @module
 */
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import { defineCommands } from "@ensiria/cli-kit/commands";
import { EXIT } from "@ensiria/cli-kit/constants";
import { formatJson, readPackageVersion } from "@ensiria/cli-kit/files";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";
import { build, createServer } from "vite";

import type { StoriesDocument, StoryDocument } from "../../src/vite/agent.types.ts";
import { filteredStories, isStoriesDocument, isStoryDocument } from "../../src/vite/agentApi.ts";
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import {
  CONFIG_FILES,
  findConfigFile,
  loadConfigFile,
  type ResolvedConfig
} from "../../src/vite/configFile.ts";
import { answerMcpMessage, NEW_SESSION } from "../../src/vite/mcpProtocol.ts";
import { catalogueDocs } from "../forgebook-docs/catalogueDocs.ts";
import type { CatalogueDocsReport } from "../forgebook-docs/catalogueDocs.types.ts";
import { catalogueClient } from "./agentClient.ts";
import { storiesText, storyText } from "./agentText.ts";
import { catalogueVite } from "./catalogueVite.ts";
import { catalogueTools } from "./mcpTools.ts";

/** The command, as the hints print it. */
const COMMAND = "forgebook";

/**
 * The catalogue's configuration: the file given, or the one in the folder the command runs in.
 *
 * @param file - the configuration file given; none to look in the current folder.
 * @throws a `ScriptError` when there is none, or it cannot be used.
 */
const configOf = async (file: string | undefined): Promise<ResolvedConfig> => {
  const found = file === undefined ? findConfigFile(process.cwd()) : resolve(file);
  if (found === undefined)
    throw new ScriptError(`No ${CONFIG_FILES[0]} here`, {
      hint: `Run ${COMMAND} in the catalogue's folder, or give --config`
    });
  try {
    return await loadConfigFile(found);
  } catch (error) {
    throw new ScriptError(error instanceof Error ? error.message : String(error));
  }
};

/**
 * Asks the catalogue one of its answers, from its running dev server or one started for the answer.
 *
 * @param config - the catalogue's configuration.
 * @param url - where `forgebook dev` runs, when not at Vite's default address.
 * @param route - the answer (`stories`, `story`).
 * @param params - its query.
 * @param log - where to say where the answer comes from.
 * @throws a `ScriptError` when the catalogue answers with an error.
 */
const askCatalogue = async (
  config: ResolvedConfig,
  url: string | undefined,
  route: string,
  params: URLSearchParams,
  log: Logger
): Promise<unknown> => {
  const client = await catalogueClient(config, url);
  log.debug(
    client.runningAt === undefined
      ? "No catalogue running: answered by a server of its own"
      : `Asked ${client.runningAt}`
  );
  let answer: AgentAnswer;
  try {
    answer = await client.ask(route, params);
  } finally {
    await client.close();
  }
  if (answer.status !== 200) {
    const { body } = answer;
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `The catalogue answered ${answer.status}`;
    throw new ScriptError(message);
  }
  return answer.body;
};

/**
 * Prints an answer, its JSON with `--json`, its problems as warnings, and ends with a failure when it has problems,
 * so a CI step fails on a broken story file.
 *
 * @param text - the answer as text for a terminal.
 * @param document - the answer as data.
 * @param problems - what is wrong in it.
 * @param context - the run's io, logger and `--json` mode.
 * @throws a reported `ScriptError` when there are problems.
 */
const printAnswer = (
  text: string,
  document: StoriesDocument | StoryDocument,
  problems: readonly string[],
  context: { readonly io: ScriptIo; readonly log: Logger; readonly isJson: boolean }
): void => {
  context.io.stdout.write(context.isJson ? formatJson(document) : `${text}\n`);
  for (const problem of problems) context.log.warn(problem);
  if (problems.length > 0)
    throw new ScriptError(`${problems.length} problems`, { exitCode: EXIT.failure, isReported: true });
};

await defineCommands({
  name: "forgebook",
  command: COMMAND,
  summary:
    "Run a catalogue of stories from its forgebook.config.ts, build it, or answer tools and agents about it.",
  icon: "docs",
  options: {
    config: {
      type: "string",
      valueName: "file",
      description: "The configuration file; forgebook.config.ts in the current folder by default."
    }
  },
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
        }
      },
      examples: [
        { command: `${COMMAND} dev`, description: "Run the catalogue of the folder you are in." },
        { command: `${COMMAND} dev --port 6006`, description: "On a given port." }
      ],
      run: async ({ options, onInterrupt }): Promise<void> => {
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
        url: {
          type: "string",
          env: "FORGEBOOK_URL",
          valueName: "address",
          description: "Where forgebook dev runs, when not at Vite's default address (http://localhost:5173)."
        }
      },
      examples: [
        { command: `${COMMAND} stories`, description: "Every story." },
        { command: `${COMMAND} stories --component button --json`, description: "The buttons, as JSON." }
      ],
      run: async ({ options, io, log, isJson, style }): Promise<void> => {
        const config = await configOf(options.config);
        const params = new URLSearchParams({ view: options.view ?? "" });
        const body = await askCatalogue(config, options.url, "stories", params, log);
        if (!isStoriesDocument(body)) throw new ScriptError("The catalogue's answer has an unexpected shape");
        const document = filteredStories(body, { source: options.source, component: options.component });
        printAnswer(storiesText(document, style), document, document.problems, { io, log, isJson });
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
          tools: catalogueTools(client.ask)
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
