/**
 * Starts a first start's pre-bundling in a child process (`prebundleChild.ts`), from the command's entry or from
 * `forgebook dev`; light, so the entry can start it before the commands load.
 *
 * @remarks
 * Vite pre-bundles a catalogue's dependencies once. Rolldown's allocator keeps what it took, a hundred megabytes and
 * more that the server would hold for as long as it runs, on top of what a first start needs for the docs. In a child
 * they go back when it ends. The child starts as the command does (`prebundleEarly`), so it works while this process
 * loads the commands, the configuration and Vite, and the server waits for it before it reads the cache folder. Should
 * the child fail, the server pre-bundles as it always could.
 *
 * Whether there is anything to do is told by the pre-bundle's metadata in Vite's default cache folder: a catalogue
 * whose framework moves the cache folder starts the child on every start, which finds the work done and ends.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findConfigFile } from "../../src/vite/configFile.ts";
import type { FramesMode } from "./catalogueVite.ts";
import { unresolvedImports, viteCacheDir } from "./viteCache.ts";

/** The child's entry, beside this module and with its extension (`.ts` in the sources, `.js` once built). */
const CHILD_URL = new URL(`./prebundleChild${extname(import.meta.url)}`, import.meta.url);

/** What the child is started with, as JSON: what `forgebook dev` was given that the pre-bundle depends on. */
export type PrebundleChildData = {
  /** The catalogue's configuration file. */
  readonly configFile: string;
  /** Whether to pre-bundle whatever is there (`--force`). */
  readonly isForced: boolean;
  /** Where the stories' frames run for this run (`--frames`); the configuration's when none. */
  readonly frames?: FramesMode;
  /** The frames' port (`--frame-port`); the configuration's when none. */
  readonly framePort?: string;
};

/** The pre-bundling started, by what it was started for: the command finds the one its entry started. */
let started: { readonly key: string; readonly done: Promise<boolean> } | undefined;

/**
 * Pre-bundles a catalogue's dependencies in a child, unless they are there already; a second call for the same
 * run waits for the first.
 *
 * @param data - what the child pre-bundles for.
 * @returns a promise of whether the child pre-bundled them: `false` when it failed, or was not needed.
 */
export const prebundleInChild = (data: PrebundleChildData): Promise<boolean> => {
  const key = JSON.stringify(data);
  if (started?.key === key) return started.done;
  const metadata = join(viteCacheDir({ root: dirname(data.configFile) }), "deps", "_metadata.json");
  if (existsSync(metadata) && !data.isForced) return Promise.resolve(false);
  const done = new Promise<boolean>((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(CHILD_URL), JSON.stringify(data)], {
      stdio: "ignore"
    });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
  started = { key, done };
  return done;
};

/** The options of `forgebook dev` the pre-bundling reads. */
export type DevPrebundleOptions = {
  /** `--force`. */
  readonly force?: boolean | undefined;
  /** `--frames`. */
  readonly frames?: FramesMode | undefined;
  /** `--frame-port`. */
  readonly "frame-port"?: string | undefined;
};

/**
 * The pre-bundling of a `forgebook dev` run: the one its entry started, or one started now.
 *
 * @param configFile - the catalogue's configuration file; none when there is none, which pre-bundles nothing.
 * @param options - the run's options.
 * @returns a promise of whether the child pre-bundled the dependencies.
 */
export const prebundleForDev = (
  configFile: string | undefined,
  options: DevPrebundleOptions
): Promise<boolean> =>
  configFile === undefined
    ? Promise.resolve(false)
    : prebundleInChild({
        configFile,
        isForced: options.force === true,
        ...(options.frames === undefined ? {} : { frames: options.frames }),
        ...(options["frame-port"] === undefined ? {} : { framePort: options["frame-port"] })
      });

/** The options of `forgebook dev` that change what it pre-bundles, or whose meaning only the command knows. */
const LEFT_TO_THE_COMMAND = ["--config", "--frames", "--frame-port", "--force", "--help", "-h"];

/**
 * Starts the pre-bundling before the commands load, for `forgebook dev` run in the catalogue's folder. Any other form
 * (`--config`, `--force`, the frames' options) is left to the command, which starts it once it has read its options.
 *
 * @param args - the command line's arguments.
 */
export const prebundleEarly = (args: readonly string[]): void => {
  if (args[0] !== "dev") return;
  if (
    args.some((arg) => LEFT_TO_THE_COMMAND.some((option) => arg === option || arg.startsWith(`${option}=`)))
  )
    return;
  const configFile = findConfigFile(process.cwd());
  if (configFile !== undefined) void prebundleInChild({ configFile, isForced: false });
};

/**
 * The dev server, built while the child pre-bundles: Vite reads the pre-bundle only once the server listens, so building
 * it meanwhile takes its configuration and plugins off the first start's path. Built again, before it listens, when what
 * the child did changes its configuration: the imports it found unresolved (part of the pre-bundle's hash) differ from
 * those the server was built with, or `--force` was given and the child could not carry it out, so the server does it.
 *
 * @typeParam TServer - the server: Vite's, or what a test builds.
 * @param root - the catalogue's folder.
 * @param prebundling - the pre-bundling: whether the child pre-bundled the dependencies.
 * @param isForced - whether `--force` was given.
 * @param create - builds the server, forcing its own pre-bundling or not, with the imports to leave out; it must not
 *   listen.
 * @returns the server, not listening yet.
 */
export const serverAfterPrebundling = async <TServer extends { readonly close: () => Promise<void> }>(
  root: string,
  prebundling: Promise<boolean>,
  isForced: boolean,
  create: (isForced: boolean, excluded: readonly string[]) => Promise<TServer>
): Promise<TServer> => {
  // what the server is built with, read once: the child may rewrite it meanwhile
  const excluded = unresolvedImports(root);
  const server = await create(false, excluded);
  const isPrebundled = await prebundling;
  const found = unresolvedImports(root);
  const isExcludedAlike = JSON.stringify(found) === JSON.stringify(excluded);
  if (isExcludedAlike && (isPrebundled || !isForced)) return server;
  await server.close();
  return create(isForced && !isPrebundled, found);
};
