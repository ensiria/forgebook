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
 * (`unref`), and `close` ends it when the build or the server ends.
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
   * Builds the program that holds a story file ahead of its first read, while the worker has nothing else to do, when
   * the disk keeps no docs: a first start, or a build, starts the worker while Vite still loads the pages.
   */
  readonly warm: (storyFile: string) => void;
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
 * A docs extractor with its worker, started on its first request.
 *
 * @param docsModule - the URL of the framework's docs module (`FrameworkAdapter.docsModule`).
 * @param options - how it reads, and where it keeps what it read.
 * @returns the extractor.
 */
export const createDocsExtractor = (
  docsModule: string,
  { readsEverything = false, cacheFolder, idleMs = IDLE_MS }: DocsExtractorOptions = {}
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
  // ends the worker once nothing is asked of it for a while; a request in the meantime keeps it
  const stopWhenIdle = (): void => {
    clearTimeout(idle);
    // a build reads every story, and a quiet stretch in it would build every program again
    if (readsEverything || pending.size > 0 || warmUps.length > 0) return;
    idle = setTimeout(() => {
      const running = worker;
      worker = undefined;
      void running?.terminate();
    }, idleMs);
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
    created.on("message", (response: DocsResponse): void => {
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
    if (request.kind === "changed") return;
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
    warm: (storyFile: string): void => {
      // only a first start, which the disk can answer nothing for: a later one reads each page's docs from the disk
      // and builds a program only for one it misses, so it stays without one until then
      if (isKeptRead && docsCache !== undefined && !docsCache.isEmpty()) return;
      warmUps.push(storyFile);
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
      const running = worker;
      worker = undefined;
      warmUps.length = 0;
      await running?.terminate();
    }
  };
};
