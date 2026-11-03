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
import { build, createServer } from "vite";

import { filteredStories, isStoriesDocument, isStoryDocument } from "../../src/vite/agentApi.ts";
import type { CatalogueDocsReport } from "../forgebook-docs/catalogueDocs.types.ts";
import { agentLoopCommands } from "./agentLoopCommands.mts";
import { storiesText, storyText } from "./agentText.ts";
import { settleAgentIndex } from "./builtCatalogue.ts";
import {
  askCatalogue,
  COMMAND,
  configOf,
  configPathOf,
  FORGEBOOK_OPTIONS,
  printAnswer
} from "./catalogueCommands.ts";
import {
  catalogueVite,
  FRAMES_MODES,
  withFramePort,
  withFramesMode,
  withReadableNames
} from "./catalogueVite.ts";
import { initCommands } from "./initCommands.mts";
import { mcpCommands } from "./mcpCommand.mts";
import { newStoriesFile } from "./newStoriesFile.ts";
import { pagesCommands } from "./pagesCommands.mts";
import { prebundle } from "./prebundleRun.ts";
import { prebundleForDev } from "./prebundleStart.ts";
import { runTokens } from "./tokensRun.ts";
import { openTouchWindow } from "./touchWindowRun.ts";
import { visualCommands } from "./visualCommands.mts";

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
        "frame-port": {
          type: "string",
          valueName: "number",
          description: "The stories' frames' port (their own origin); the catalogue's port + 1 by default."
        },
        frames: {
          type: "string",
          choices: FRAMES_MODES,
          valueName: "placement",
          description:
            "Where the stories' frames run for this run: on an origin of their own, or on the catalogue's (frames in the configuration)."
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
        { command: `${COMMAND} dev --touch`, description: "And try the stories with Chromium's real touch." },
        {
          command: `${COMMAND} dev --frames same-origin`,
          description: "With the frames on the catalogue's origin, as behind a proxy that forwards one port."
        }
      ],
      run: async ({ options, onInterrupt, log }): Promise<void> => {
        const isForced = options.force === true;
        // the one the entry started, when it could; it works while the configuration loads
        const prebundling = prebundleForDev(configPathOf(options.config), options);
        const read = withFramesMode(await configOf(options.config), options.frames);
        const config = withFramePort(read, options["frame-port"]);
        const port = options.port === undefined ? undefined : Number(options.port);
        if (port !== undefined && !Number.isInteger(port))
          throw new ScriptError(`--port ${options.port} is not a port`);
        // the server reads the cache folder the child writes; should the child have failed, it does the work itself
        const isPrebundled = await prebundling;
        const server = await createServer(
          await catalogueVite(config, {
            server: {
              ...(port === undefined ? {} : { port, strictPort: true }),
              ...(options.host === undefined ? {} : { host: options.host })
            },
            ...(isForced && !isPrebundled ? { optimizeDeps: { force: true } } : {})
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
    prebundle: forgebook.command({
      summary: "Pre-bundle the catalogue's dependencies: what dev does on a first start.",
      options: {
        force: { type: "boolean", description: "Pre-bundle them again, ignoring Vite's cache." }
      },
      examples: [
        { command: `${COMMAND} prebundle`, description: "Before the first start, in CI or an image." }
      ],
      run: async ({ options }): Promise<void> =>
        prebundle(await configOf(options.config), options.force === true)
    }),
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
        const config = withReadableNames(await configOf(options.config), options["readable-names"]);
        const outDir = resolve(config.dir, options.out ?? "dist");
        await build(
          await catalogueVite(config, {
            ...(options.base === undefined ? {} : { base: options.base }),
            build: { outDir }
          })
        );
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
