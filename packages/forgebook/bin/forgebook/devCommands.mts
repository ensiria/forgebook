/**
 * The `forgebook` commands that run a catalogue's dev server: `dev`, and `prebundle`, the dependencies' pre-bundling
 * a first start does.
 *
 * @module
 */
import type { CommandNode, CommandScope } from "@ensiria/cli-kit/commands.types";
import { ScriptError } from "@ensiria/cli-kit/script";
import { createServer } from "vite";

import { COMMAND, configOf, configPathOf, type ForgebookOptions } from "./catalogueCommands.ts";
import {
  catalogueVite,
  devServerOptions,
  FRAMES_MODES,
  withFramePort,
  withFramesMode
} from "./catalogueVite.ts";
import { prebundle } from "./prebundleRun.ts";
import { prebundleForDev } from "./prebundleStart.ts";
import { openTouchWindow } from "./touchWindowRun.ts";

/**
 * The commands.
 *
 * @param forgebook - the scope of the `forgebook` command, whose options every command takes.
 */
export const devCommands = (
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
      poll: {
        type: "boolean",
        description:
          "Notice file edits by checking the files every 100 ms instead of waiting for the system's change events: " +
          "for files whose events come late or never (a container's mounted volume, a Windows drive under WSL, a " +
          "network drive, an overloaded machine). Costs some processor time."
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
        command: `${COMMAND} dev --poll`,
        description: "In a container or under WSL, where an edit's change event does not reach the server."
      },
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
          server: devServerOptions({ port, host: options.host, isPolling: options.poll === true }),
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
  })
});
