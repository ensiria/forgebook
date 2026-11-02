/**
 * The commands that run a catalogue: `dev`, `prebundle` and `build`.
 *
 * @remarks
 * Defined here, on the scope `forgebook.mts` hands them, so the entry stays a list of commands.
 *
 * @module
 */
import { flushCompileCache } from "node:module";
import { resolve } from "node:path";

import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { settleAgentIndex } from "./builtCatalogue.ts";
import { COMMAND, configOf, configPathOf, type ForgebookOptions } from "./catalogueCommands.ts";
import { catalogueVite } from "./catalogueVite.ts";
import { prebundle, prebundleInChild } from "./prebundleRun.ts";
import { openTouchWindow } from "./touchWindowRun.ts";

/**
 * The commands, on the root's scope.
 *
 * @param forgebook - the root's scope.
 */
export const serveCommands = (
  forgebook: CommandScope<ForgebookOptions>
): Readonly<Record<string, CommandNode>> => ({
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
      const configFile = configPathOf(options.config);
      const prebundling =
        configFile === undefined ? Promise.resolve() : prebundleInChild(configFile, options.force === true);
      const { createServer } = await import("vite");
      await prebundling;
      const server = await createServer(
        await catalogueVite(config, {
          server: {
            ...(port === undefined ? {} : { port, strictPort: true }),
            ...(options.host === undefined ? {} : { host: options.host })
          }
        })
      );
      await server.listen();
      server.printUrls();
      // now, and not at exit: the server may well end by a signal, which writes nothing
      flushCompileCache();
      if (options.touch === true) await openTouchWindow(config.dir, server.resolvedUrls?.local[0], log);
      await new Promise<void>((done) => {
        onInterrupt(() => {
          void server.close().then(done);
        });
      });
    }
  }),
  prebundle: forgebook.command({
    summary: "Pre-bundle the catalogue's dependencies: what `dev` does on a first start.",
    options: { force: { type: "boolean", description: "Pre-bundle them again, ignoring Vite's cache." } },
    examples: [{ command: `${COMMAND} prebundle`, description: "Before the first start, in CI." }],
    run: async ({ options }): Promise<void> => prebundle(await configOf(options.config), options.force)
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
      const config = await configOf(options.config);
      const { build } = await import("vite");
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
  })
});
