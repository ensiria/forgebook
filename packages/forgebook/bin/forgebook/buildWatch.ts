/**
 * `forgebook build --watch`: builds the catalogue, then again each time a file it reads changes, so a folder served
 * elsewhere (a preview host, a second machine, an embed in an app) follows the code without a dev server.
 *
 * @remarks
 * The bundler's watch mode with its incremental option keeps what it can between builds, and the process keeps the
 * catalogue's configuration, which is about a third of a whole build on a large catalogue; it still writes the whole
 * output. It watches the files a build read, so a file nothing read yet cannot wake it: a new story file reaches the list only by a build
 * that starts over, and that is what a changed listing does. The lists are read again on a timer rather than with a
 * folder watch, because a pattern's folder may be the project itself, and watching `node_modules` is what a catalogue
 * must not cost on Linux. A failed build leaves the last good output and waits for the next edit.
 *
 * The files are polled: the operating system's file events go missing on a busy machine, and a watch that silently
 * misses an edit leaves a site out of date with nothing to say so; asking only about the files a build read costs little.
 *
 * @module
 */
import type { Logger } from "@ensiria/cli-kit/log.types";
import {
  type BuildEnvironmentOptions,
  build,
  createLogger,
  type InlineConfig,
  type Plugin,
  type Logger as ViteLogger
} from "vite";

import {
  DOCS_PAGES_SPECIFIER_PREFIX,
  FILES_SPECIFIER_PREFIX,
  storyFileKeys,
  storyFilesGroupOf
} from "../../src/vite/storyFilesModule.ts";
import { buildFailureText } from "./buildFailure.ts";

/** How often the lists of story files and docs pages are read again, in ms. */
const LISTING_PERIOD = 1000;

/** How often the files a build read are asked for changes, in ms. */
const FILE_PERIOD = 300;

/** The watch's polling: `watcher` is the bundler's own option, and Vite builds it from `chokidar`, which it reads. */
const POLLED_WATCH: NonNullable<BuildEnvironmentOptions["watch"]> & {
  readonly chokidar: { readonly usePolling: boolean; readonly interval: number };
} = {
  chokidar: { usePolling: true, interval: FILE_PERIOD },
  watcher: { usePolling: true, pollInterval: FILE_PERIOD }
};

/** The groups' module ids a build reads, each holding a group after its prefix. */
const GROUP_PREFIXES: readonly string[] = [FILES_SPECIFIER_PREFIX, DOCS_PAGES_SPECIFIER_PREFIX].map(
  (prefix) => `\0${prefix}`
);

/**
 * Vite's logger for a watch: its warnings, without its errors, whose bundler stack this command says on one line.
 */
const quietLogger = (): ViteLogger => ({ ...createLogger("warn"), error: (): void => undefined });

/** What each group lists: by the group's text, its files in order, one text a group. */
export type Listing = ReadonlyMap<string, string>;

/**
 * What the groups of a build list now.
 *
 * @param moduleIds - the build's module ids; those that are no group are skipped.
 * @param listFiles - lists a group's files; the disk by default.
 */
export const listingOf = (
  moduleIds: Iterable<string>,
  listFiles: (group: string) => readonly string[] = (group: string): readonly string[] => {
    const { root, patterns } = storyFilesGroupOf(group);
    return storyFileKeys(root, patterns);
  }
): Listing => {
  const listing = new Map<string, string>();
  for (const id of moduleIds) {
    const prefix = GROUP_PREFIXES.find((each) => id.startsWith(each));
    if (prefix === undefined) continue;
    const group = id.slice(prefix.length);
    listing.set(id, listFiles(group).join("\n"));
  }
  return listing;
};

/**
 * Whether two listings differ: a file added to a group or taken from it.
 *
 * @param before - what the last build listed.
 * @param now - what the groups list now.
 */
export const isListingChanged = (before: Listing, now: Listing): boolean =>
  before.size !== now.size || [...before].some(([id, files]) => now.get(id) !== files);

/** What a watch reports. */
export type BuildWatchOptions = {
  /** The Vite configuration of the build, `build.outDir` set. */
  readonly vite: InlineConfig;
  /** Where it says what each build did. */
  readonly log: Logger;
  /** Called after each build that succeeded, before it is announced: what must follow the output. */
  readonly onBuilt: () => Promise<void>;
  /** Ends the watch when it aborts; the watch runs until then. */
  readonly signal: AbortSignal;
};

/** The watcher Vite's build gives in watch mode, as far as this file uses it. */
type Watching = Extract<Awaited<ReturnType<typeof build>>, { readonly close: () => unknown }>;

/**
 * One run of the bundler's watch mode: resolves when the list of files changes, so a new one starts, or the signal
 * aborts.
 *
 * @param options - what to build and report.
 * @returns whether a new run must start.
 */
const watchUntilListed = async ({ vite, log, onBuilt, signal }: BuildWatchOptions): Promise<boolean> => {
  let moduleIds: readonly string[] = [];
  const noteModules: Plugin = {
    name: "forgebook:build-watch",
    buildEnd(): void {
      moduleIds = [...this.getModuleIds()];
    }
  };
  const output = await build({
    ...vite,
    logLevel: "warn",
    customLogger: quietLogger(),
    plugins: [...(vite.plugins ?? []), noteModules],
    build: {
      ...vite.build,
      watch: POLLED_WATCH,
      rolldownOptions: {
        ...vite.build?.rolldownOptions,
        experimental: { ...vite.build?.rolldownOptions?.experimental, incrementalBuild: true }
      }
    }
  });
  if (!("on" in output)) return false;
  const watcher: Watching = output;
  let changes: readonly string[] = [];
  let listed: Listing | undefined;
  let isBuilding = true;
  // one after another: a slow index after a build must never land over the next build's
  let settling: Promise<void> = Promise.resolve();
  watcher.on("change", (file: string): void => {
    changes = [...changes, file];
  });
  watcher.on("event", (event): void => {
    if (event.code === "START") isBuilding = true;
    if (event.code === "ERROR") {
      isBuilding = false;
      log.error(buildFailureText(event.error));
      log.info("Waiting for the next edit");
    }
    if (event.code !== "BUNDLE_END") return;
    const touched = changes;
    changes = [];
    listed = listingOf(moduleIds);
    settling = settling.then(onBuilt).then(
      () => {
        isBuilding = false;
        const note = touched.length === 0 ? "" : ` after ${touched.length} changed`;
        log.success(`Built in ${event.duration} ms${note}; watching for changes`);
      },
      (error: unknown) => {
        isBuilding = false;
        log.error(error instanceof Error ? error.message : String(error));
      }
    );
  });
  try {
    return await new Promise<boolean>((resolve) => {
      signal.addEventListener("abort", () => resolve(false), { once: true });
      const timer = setInterval(() => {
        // a list read while a build runs would be compared with the build before it
        if (isBuilding || listed === undefined) return;
        if (!isListingChanged(listed, listingOf(listed.keys()))) return;
        clearInterval(timer);
        log.info("The list of files changed: building from the start");
        resolve(true);
      }, LISTING_PERIOD);
      signal.addEventListener("abort", () => clearInterval(timer), { once: true });
    });
  } finally {
    await watcher.close();
  }
};

/**
 * Builds, then builds again on every change, until the signal aborts.
 *
 * @param options - what to build and report.
 */
export const watchBuild = async (options: BuildWatchOptions): Promise<void> => {
  while (await watchUntilListed(options)) {
    // each run is a watch of its own; a list changing again starts another
  }
};
