#!/usr/bin/env node
/**
 * The `forgebook` command: runs a catalogue from its `forgebook.config.ts` (`dev`, the dev server) or builds it into
 * static files (`build`), with no page or Vite configuration of the app's own.
 *
 * @module
 */
import { resolve } from "node:path";

import { defineScript, ScriptError } from "@ensiria/cli-kit/script";
import { build, createServer } from "vite";

import {
  CONFIG_FILES,
  findConfigFile,
  loadConfigFile,
  type ResolvedConfig
} from "../../src/vite/configFile.ts";
import { catalogueVite } from "./catalogueVite.ts";

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

await defineScript({
  name: "forgebook",
  command: COMMAND,
  summary: "Run a catalogue of stories from its forgebook.config.ts, or build it into static files.",
  icon: "docs",
  options: {
    config: {
      type: "string",
      valueName: "file",
      description: "The configuration file; forgebook.config.ts in the current folder by default."
    },
    port: {
      type: "string",
      valueName: "number",
      description: "dev: the port to listen on; Vite's by default."
    },
    host: {
      type: "string",
      valueName: "address",
      description: "dev: the address to listen on; localhost by default."
    },
    out: { type: "string", valueName: "folder", description: "build: the folder to write; dist by default." },
    force: {
      type: "boolean",
      description: "dev: pre-bundle the dependencies again, ignoring Vite's cache (as a first start does)."
    }
  },
  positionals: [{ name: "command", description: "What to do.", required: true, choices: ["dev", "build"] }],
  examples: [
    { command: `${COMMAND} dev`, description: "Run the catalogue of the folder you are in." },
    { command: `${COMMAND} dev --port 6006`, description: "On a given port." },
    { command: `${COMMAND} build --out site`, description: "Build it into static files." }
  ],
  run: async ({ args, options, log, onInterrupt }): Promise<void> => {
    const config = await configOf(options.config);
    if (args.command === "build") {
      await build(
        await catalogueVite(config, { build: { outDir: resolve(config.dir, options.out ?? "dist") } })
      );
      log.success(`${config.title} built`);
      return;
    }
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
}).run();
