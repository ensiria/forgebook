/**
 * The story files' component docs, and the facts "Used in" is joined from (`usageGraph.ts`), read in a worker thread
 * (`docsWorker.ts`) so the dev server keeps answering while a package's TypeScript program is built.
 *
 * @remarks
 * One worker per plugin, started on the first request the disk cannot answer: its programs make every later read
 * quick, until a source file changes (`changed`, which the dev server's watcher sends). A TypeScript program is the
 * largest thing the server holds, and an answer kept on disk from an earlier start (`diskCache.ts`, with the files it
 * was read from, `docsDependencies.ts`) needs none: a pattern's first story starts the worker early (`warm`) only when
 * the disk keeps no docs at all (a first start, a build), one warm-up at a time and only while nothing waits. For the
 * same reason a dev server's worker left with nothing to do ends (`IDLE_MS`), so the memory a first start took does
 * not stay with the server until it stops. Requests are answered in order. The worker never keeps the process alive
 * (`unref`), and `close` ends it when the build or the server ends, once its modules are loaded (`endOnceLoaded`).
 *
 * @module
 */
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import type { StoryComponentResult } from "./adapter.ts";
import { packageResolver } from "./configFile.ts";
import { codeStamp, type DiskCache, diskCache, type PathStamp } from "./diskCache.ts";
import type { UsageGraph, UsageRequestFile } from "./usageGraph.ts";

/** What the extractor answers for a story file: its component's docs, none, or why it cannot be read. */
export type DocsResult = StoryComponentResult;

/** What the worker answers for a group of story files' usage: its facts, or why they cannot be read. */
export type UsageResult = UsageGraph | string;

/**
 * A message to the worker: a story file's docs to read, a group of story files' usage to read, or the news that a
 * source file changed.
 */
export type DocsRequest =
  | {
      /** Read a story file's docs. */
      readonly kind: "extract";
      /** The request's number, repeated in its answer. */
      readonly id: number;
      /** The story file's absolute path. */
      readonly storyFile: string;
    }
  | {
      /** Read what a group of story files' stories render, and the import graph they reach. */
      readonly kind: "usage";
      /** The request's number, repeated in its answer. */
      readonly id: number;
      /** The story files and their stories' exports. */
      readonly files: readonly UsageRequestFile[];
    }
  | {
      /** A source file changed: the programs are renewed on their next read. */
      readonly kind: "changed";
    }
  | {
      /** A build's story files: each program holds what they reach rather than its whole configuration. */
      readonly kind: "stories";
      /** The story files, absolute. */
      readonly files: readonly string[];
    };

/** The worker's answer to a request, of the request's kind. */
export type DocsResponse =
  | {
      /** A story file's docs. */
      readonly kind: "extract";
      /** The request's number. */
      readonly id: number;
      /** The extractor's result. */
      readonly result: DocsResult;
      /**
       * The paths it can change with, stamped (`docsDependencies.ts`); none when it is not to be kept: a story file
       * that cannot be read, or one of them changed while it was read.
       */
      readonly stamps: readonly PathStamp[] | undefined;
    }
  | {
      /** A group of story files' usage. */
      readonly kind: "usage";
      /** The request's number. */
      readonly id: number;
      /** The facts, or why they cannot be read. */
      readonly result: UsageResult;
      /** The paths they can change with, stamped; none when they are not to be kept. */
      readonly stamps: readonly PathStamp[] | undefined;
    };

/** The docs, read off the dev server's thread. */
export type DocsExtractor = {
  /** The component docs of a story file. */
  readonly extract: (storyFile: string) => Promise<DocsResult>;
  /** What a group of story files' stories render, and the import graph they reach. */
  readonly usage: (files: readonly UsageRequestFile[]) => Promise<UsageResult>;
  /**
   * Builds the program that holds a group's first story file ahead of its first read, while the worker has nothing else
   * to do, when the disk keeps no docs: a first start, or a build, starts the worker while Vite still loads the pages.
   * A build's worker is told every file of the group first, so its programs hold what the stories reach.
   */
  readonly warm: (storyFiles: readonly string[]) => void;
  /** Tells the worker a source file changed, so the next read sees it. */
  readonly changed: () => void;
  /**
   * Tells it a source file was added or removed: a kept answer is not read again this session, since a new file can
   * change what a file's imports find or what holds for every file (a declaration) without touching what it read.
   */
  readonly listed: () => void;
  /** Ends the worker; a later request starts a new one. */
  readonly close: () => Promise<void>;
};

/**
 * The worker's module, beside this one and with its extension: `.ts` in the sources, whose types Node strips, `.js`
 * once built for npm, where Node strips none.
 */
const WORKER_URL = new URL(`./docsWorker${extname(import.meta.url)}`, import.meta.url);

/** What the worker is started with: the framework's docs module, which it loads before its first answer. */
export type DocsWorkerData = {
  /** The URL of the module exporting the framework's `extractStoryComponent`. */
  readonly docsModule: string;
  /**
   * Whether every story's docs will be read, as in a build: each program then holds its whole configuration at once,
   * rather than what was asked for so far, which a dev server showing one component at a time needs.
   */
  readonly readsEverything: boolean;
  /** Whether its answers are kept on disk, so it stamps what each was read from; a build's are not. */
  readonly keepsAnswers: boolean;
};

/** What the worker says of its own, unasked: that its modules, the framework's docs module's included, are loaded. */
export type DocsWorkerLoaded = {
  /** The message's kind. */
  readonly kind: "loaded";
};

/** How an extractor reads. */
export type DocsExtractorOptions = {
  /** Whether every story's docs will be read, as in a build; a dev server's reads by default. */
  readonly readsEverything?: boolean;
  /** Where answers are kept between starts (`diskCache.ts`); none reads every time. */
  readonly cacheFolder?: string;
  /**
   * How long the worker stays with nothing to do before it ends, in milliseconds; `IDLE_MS` by default. A build's
   * never ends before the build does.
   */
  readonly idleMs?: number;
  /** How long ending the worker waits for its modules to load, in milliseconds; `LOAD_WAIT_MS` by default. */
  readonly loadWaitMs?: number;
};

/** Whether what a cache file holds is a story file's docs, never a message. */
const isKeptDocs = (value: unknown): value is Exclude<DocsResult, string> =>
  typeof value === "object" && value !== null && "docs" in value;

/** Whether what a cache file holds is a group's usage, never a message. */
const isKeptUsage = (value: unknown): value is UsageGraph =>
  typeof value === "object" && value !== null && "files" in value && "imports" in value;

/**
 * The worker's young generation on a dev server, in MB. V8 sizes it for throughput, but a program's heap survives
 * its collections, so a large young generation is mostly empty memory the worker keeps; a dev server reads one
 * component at a time, where collecting more often costs little.
 */
const YOUNG_GENERATION_MB = 8;

/**
 * How long a dev server's worker stays with nothing to do, in milliseconds, before it ends. Its programs are the
 * largest thing the server holds: a session that stops reading docs gives their memory back, while one that edits and
 * looks keeps them, renewed after each edit rather than built again (seconds, in a large monorepo).
 */
export const IDLE_MS = 5 * 60_000;

/**
 * How long ending a worker waits for its modules to load, in milliseconds: well past a slow machine's load of the
 * compiler, and a limit so that a docs module whose loading never ends cannot keep a server from closing.
 */
const LOAD_WAIT_MS = 30_000;

/**
 * The worker's young generation in a build, in MB: a build reads every story's docs in one go, and with the dev
 * server's small one it would spend much of that time collecting garbage.
 */
const BUILD_YOUNG_GENERATION_MB = 64;

/**
 * The stamp of the code that reads the docs: the worker's folder, the framework's docs module's and the compiler's
 * version; none when the module is not a file whose folder can be read, which keeps nothing.
 *
 * @param docsModule - the URL of the framework's docs module.
 */
const codeStampOf = (docsModule: string): string | undefined => {
  try {
    const workerFolder = dirname(fileURLToPath(WORKER_URL));
    // the compiler's version too: it reads every answer
    const compiler = packageResolver(workerFolder)("typescript-6");
    return codeStamp(
      [workerFolder, dirname(fileURLToPath(docsModule))],
      compiler === undefined ? [] : [compiler]
    );
  } catch {
    return undefined;
  }
};

/**
 * The extractor of a catalogue that reads no component docs (`componentDocs: false`): it starts no worker and builds no
 * TypeScript program, answers every story file as one whose meta names no component, and every group's usage with why
 * there is none.
 */
export const NO_DOCS_EXTRACTOR: DocsExtractor = {
  extract: () => Promise.resolve({ docs: { name: null } }),
  usage: () => Promise.resolve("The catalogue reads no component docs (componentDocs: false)"),
  warm: () => undefined,
  changed: () => undefined,
  listed: () => undefined,
  close: () => Promise.resolve()
};

/**
 * Ends a worker once its modules are loaded.
 *
 * @remarks
 * Node 24 aborts the whole process when a worker is terminated while it reads the exports of a CommonJS module it
 * imports, and the compiler is one: a command answered before the warm-up's worker had loaded would die with nothing
 * printed. Past the loading, terminating is safe and stops a program being built at once, which a request to the worker
 * to end by itself would have to wait for.
 *
 * @param worker - the worker.
 * @param loaded - settled once its modules are loaded, or it has ended.
 * @param waitMs - how long to wait for that, in milliseconds.
 */
const endOnceLoaded = async (worker: Worker, loaded: Promise<void>, waitMs: number): Promise<void> => {
  let limit: ReturnType<typeof setTimeout> | undefined;
  const overLimit = new Promise<void>((resolve) => {
    limit = setTimeout(resolve, waitMs);
  });
  await Promise.race([loaded, overLimit]);
  clearTimeout(limit);
  await worker.terminate();
};

/**
 * A docs extractor with its worker, started on its first request.
 *
 * @param docsModule - the URL of the framework's docs module (`FrameworkAdapter.docsModule`).
 * @param options - how it reads, and where it keeps what it read.
 * @returns the extractor.
 */
export const createDocsExtractor = (
  docsModule: string,
  {
    readsEverything = false,
    cacheFolder,
    idleMs = IDLE_MS,
    loadWaitMs = LOAD_WAIT_MS
  }: DocsExtractorOptions = {}
): DocsExtractor => {
  // the code that writes the answers: this package's and the framework's docs, whose edit or new version is a miss
  const code = cacheFolder === undefined ? undefined : codeStampOf(docsModule);
  const cacheOf = <TValue>(
    kind: string,
    isValue: (value: unknown) => value is TValue & {}
  ): DiskCache<TValue> | undefined =>
    cacheFolder === undefined || code === undefined
      ? undefined
      : diskCache(join(cacheFolder, kind), code, isValue);
  const docsCache = cacheOf("docs", isKeptDocs);
  const usageCache = cacheOf("usage", isKeptUsage);
  let worker: Worker | undefined;
  // settled once the current worker's modules are loaded, or it has ended
  let workerLoaded: Promise<void> = Promise.resolve();
  let nextId = 0;
  // the changes the watcher reported: an answer read across one may have read a file before it changed, so it is not kept
  let changes = 0;
  // whether kept answers are read: until a source file is added or removed while the server runs
  let isKeptRead = true;
  // a group's usage asked again before the worker answered (its "Used in" and its reach), by request and changes
  const usageAsked = new Map<string, Promise<UsageResult>>();
  // every request sent and not answered yet, a warm-up's included (none reads its answer)
  const pending = new Map<number, (response: DocsResponse | string) => void>();
  // the warm-ups not sent yet: one goes out only when nothing is pending, so a read never waits behind them all
  const warmUps: string[] = [];
  let idle: ReturnType<typeof setTimeout> | undefined;
  // every ending under way: a second close must wait for the first's too, as a process may exit once it resolves
  let ending: Promise<unknown> = Promise.resolve();
  // lets the current worker go, so the next request starts another, and ends it
  const endWorker = async (): Promise<void> => {
    const running = worker;
    worker = undefined;
    if (running !== undefined)
      ending = Promise.all([ending, endOnceLoaded(running, workerLoaded, loadWaitMs)]);
    await ending;
  };
  // ends the worker once nothing is asked of it for a while; a request in the meantime keeps it
  const stopWhenIdle = (): void => {
    clearTimeout(idle);
    // a build reads every story, and a quiet stretch in it would build every program again
    if (readsEverything || pending.size > 0 || warmUps.length > 0) return;
    idle = setTimeout(() => void endWorker(), idleMs);
    idle.unref();
  };
  const sendWarmUp = (): void => {
    if (pending.size > 0) return;
    const storyFile = warmUps.shift();
    if (storyFile !== undefined) send({ kind: "extract", id: nextId++, storyFile }, () => sendWarmUp());
  };
  const started = (): Worker => {
    clearTimeout(idle);
    if (worker !== undefined) return worker;
    const workerData: DocsWorkerData = { docsModule, readsEverything, keepsAnswers: code !== undefined };
    const created = new Worker(WORKER_URL, {
      workerData,
      resourceLimits: {
        maxYoungGenerationSizeMb: readsEverything ? BUILD_YOUNG_GENERATION_MB : YOUNG_GENERATION_MB
      }
    });
    created.unref();
    workerLoaded = new Promise((resolve) => {
      created.on("message", (message: DocsResponse | DocsWorkerLoaded): void => {
        if (message.kind === "loaded") resolve();
      });
      created.once("exit", () => resolve());
    });
    created.on("message", (response: DocsResponse | DocsWorkerLoaded): void => {
      if (response.kind === "loaded") return;
      pending.get(response.id)?.(response);
      pending.delete(response.id);
      sendWarmUp();
      stopWhenIdle();
    });
    // a worker that dies answers every request still waiting with why, and the next request starts a new one
    created.on("error", (error: Error): void => {
      for (const resolve of pending.values()) resolve(`The docs' worker stopped: ${error.message}`);
      pending.clear();
      // a worker ended when idle and replaced since leaves the new one in place
      if (worker === created) worker = undefined;
    });
    worker = created;
    return created;
  };
  // a request's answer, or why the worker stopped before giving it
  const send = (request: DocsRequest, resolve: (response: DocsResponse | string) => void): void => {
    if (request.kind === "changed" || request.kind === "stories") return;
    pending.set(request.id, resolve);
    started().postMessage(request);
  };
  return {
    extract: (storyFile: string): Promise<DocsResult> =>
      new Promise((resolve) => {
        const kept = isKeptRead ? docsCache?.read(storyFile) : undefined;
        if (kept !== undefined) {
          resolve(kept);
          return;
        }
        const asked = changes;
        send({ kind: "extract", id: nextId++, storyFile }, (response) => {
          if (typeof response === "string" || response.kind !== "extract") {
            resolve(String(response));
            return;
          }
          const { result, stamps } = response;
          if (typeof result !== "string" && stamps !== undefined && changes === asked)
            docsCache?.write(storyFile, result, stamps);
          resolve(result);
        });
      }),
    usage: (files: readonly UsageRequestFile[]): Promise<UsageResult> => {
      // a group is its story files and what each renders: the same files with other stories are another group
      const key = JSON.stringify(files);
      const asked = changes;
      const pending = usageAsked.get(`${asked}:${key}`);
      if (pending !== undefined) return pending;
      const read = new Promise<UsageResult>((resolve) => {
        const kept = isKeptRead ? usageCache?.read(key) : undefined;
        if (kept !== undefined) {
          resolve(kept);
          return;
        }
        send({ kind: "usage", id: nextId++, files }, (response) => {
          if (typeof response === "string" || response.kind !== "usage") {
            resolve(String(response));
            return;
          }
          const { result, stamps } = response;
          if (typeof result !== "string" && stamps !== undefined && changes === asked)
            usageCache?.write(key, result, stamps);
          resolve(result);
        });
      });
      usageAsked.set(`${asked}:${key}`, read);
      void read.finally(() => usageAsked.delete(`${asked}:${key}`));
      return read;
    },
    changed: (): void => {
      changes += 1;
      // a worker not started yet has no program to renew
      const request: DocsRequest = { kind: "changed" };
      worker?.postMessage(request);
    },
    warm: (storyFiles: readonly string[]): void => {
      if (readsEverything && storyFiles.length > 0) {
        // before any read of them, so no program is built whole first
        const request: DocsRequest = { kind: "stories", files: storyFiles };
        started().postMessage(request);
      }
      // only a first start, which the disk can answer nothing for: a later one reads each page's docs from the disk
      // and builds a program only for one it misses, so it stays without one until then
      if (isKeptRead && docsCache !== undefined && !docsCache.isEmpty()) return;
      const [first] = storyFiles;
      if (first === undefined) return;
      warmUps.push(first);
      sendWarmUp();
    },
    listed: (): void => {
      isKeptRead = false;
      changes += 1;
      const request: DocsRequest = { kind: "changed" };
      worker?.postMessage(request);
    },
    close: async (): Promise<void> => {
      clearTimeout(idle);
      warmUps.length = 0;
      await endWorker();
    }
  };
};
