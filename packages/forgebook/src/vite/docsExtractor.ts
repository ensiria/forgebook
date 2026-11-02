/**
 * The story files' component docs, and the facts "Used in" is joined from (`usageGraph.ts`), read in a worker thread
 * (`docsWorker.ts`) so the dev server keeps answering while a package's TypeScript program is built.
 *
 * @remarks
 * One worker per plugin, started on the first request: its programs make every later read quick, until a
 * source file changes (`changed`, which the dev server's watcher sends). Nothing starts it ahead of a request, and a
 * request the disk answers (`diskCache.ts`) starts nothing: a TypeScript program is half the server's memory. A worker
 * left with nothing to do ends, for the same reason: what it held is then the process's to reuse, so a later read
 * does not add to it. A thread and not a process: a second Node is forty megabytes more on every first start. Requests
 * are answered in order. The worker never keeps the server alive (`unref`), and `close` ends it when the build or the
 * server ends.
 *
 * @module
 */

import { statSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import type { StoryComponentResult } from "./adapter.ts";
import { type DiskCache, diskCache } from "./diskCache.ts";
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
      /** The files it can change with; none for a story file that cannot be read. */
      readonly dependencies: readonly string[];
    }
  | {
      /** A group of story files' usage. */
      readonly kind: "usage";
      /** The request's number. */
      readonly id: number;
      /** The facts, or why they cannot be read. */
      readonly result: UsageResult;
      /** The files they can change with; none when they cannot be read. */
      readonly dependencies: readonly string[];
    };

/** The docs, read off the dev server's thread. */
export type DocsExtractor = {
  /** The component docs of a story file. */
  readonly extract: (storyFile: string) => Promise<DocsResult>;
  /** What a group of story files' stories render, and the import graph they reach. */
  readonly usage: (files: readonly UsageRequestFile[]) => Promise<UsageResult>;
  /** Tells the worker a source file changed, so the next read sees it. */
  readonly changed: () => void;
  /** Ends the worker; a later request starts a new one. */
  readonly close: () => Promise<void>;
};

/**
 * The worker's module, beside this one and with its extension: `.ts` in the sources, whose types Node strips, `.js`
 * once built for npm, where Node strips none.
 */
const WORKER_URL = new URL(`./docsWorker${extname(import.meta.url)}`, import.meta.url);

/** The memory a machine needs for a build to read the docs and "Used in" in two workers at once, in bytes. */
const TWO_READERS_MEMORY = 16 * 1024 ** 3;

/**
 * Whether a build may read the docs and "Used in" in two workers at once: each holds a program of the whole library, so
 * two need room, and a second core to run on.
 */
const hasRoomForTwoReaders = (): boolean => totalmem() >= TWO_READERS_MEMORY && availableParallelism() > 2;

/**
 * The worker's young generation on a dev server, in MB. V8 sizes it for throughput, and the heap of a program, which
 * survives, never needs one this large: left alone it is half the worker's memory, and reading one program takes no
 * longer without it.
 */
const YOUNG_GENERATION_MB = 8;

/**
 * The worker's young generation in a build, in MB: a build reads every story's docs and every group's "Used in", and
 * with the dev server's 8 MB a third of Fluent UI's build went to collecting garbage (66 s, against 41 s with this, for
 * about a hundred MB more at the peak; 128 MB was no faster).
 */
const BUILD_YOUNG_GENERATION_MB = 64;

/**
 * How long the worker stays with nothing to do, in milliseconds. Its programs are the heaviest thing the server holds,
 * and one edit needs them once: the next read rebuilds them in under a second, and meanwhile the memory goes back.
 */
const IDLE_MS = 30_000;

/** Whether a message of the worker is an answer. */
const isDocsResponse = (message: unknown): message is DocsResponse =>
  typeof message === "object" && message !== null && "kind" in message && "id" in message;

/** What the worker is started with: the framework's docs module, which it loads before its first answer. */
export type DocsWorkerData = {
  /** The URL of the module exporting the framework's `extractStoryComponent`. */
  readonly docsModule: string;
  /** Whether every story file will be read, as in a build, so a program may as well hold them all at once. */
  readonly readsEverything: boolean;
};

/** How an extractor is used. */
export type DocsExtractorOptions = {
  /** Where answers are kept between starts; none reads every time. */
  readonly cacheFolder?: string | undefined;
  /** Whether every story file will be read (`DocsWorkerData`). */
  readonly readsEverything?: boolean;
};

/** Whether what a cache file holds is an answer: docs of a story file, and never a message. */
const isCachedDocs = (value: unknown): value is Exclude<DocsResult, string> =>
  typeof value === "object" && value !== null && "docs" in value;

/** Whether what a cache file holds is a group's usage, and never a message. */
const isCachedUsage = (value: unknown): value is UsageGraph =>
  typeof value === "object" && value !== null && "files" in value && "imports" in value;

/** What made a kept answer: the times of the code that wrote it, so a new install is a miss. */
const stampOf = (docsModule: string): string =>
  [docsModule, ...[WORKER_URL.href, docsModule].map((url) => statSync(fileURLToPath(url)).mtimeMs)].join(" ");

/**
 * One reader of the docs and "Used in", in a worker of its own.
 *
 * @param docsModule - the framework's docs module.
 * @param options - where to keep what it read, and whether it reads every file.
 */
const readerOf = (
  docsModule: string,
  { cacheFolder, readsEverything = false }: DocsExtractorOptions = {}
): DocsExtractor => {
  const stamp = cacheFolder === undefined ? undefined : stampOf(docsModule);
  const cacheOf = <TValue>(
    kind: string,
    isValue: (value: unknown) => value is TValue & {}
  ): DiskCache<TValue> | undefined =>
    cacheFolder === undefined || stamp === undefined
      ? undefined
      : diskCache(join(cacheFolder, kind), stamp, isValue);
  const docsCache = cacheOf<Exclude<DocsResult, string>>("docs", isCachedDocs);
  const usageCache = cacheOf<UsageGraph>("usage", isCachedUsage);
  let worker: Worker | undefined;
  let nextId = 0;
  // every request sent and not answered yet
  const pending = new Map<number, (response: DocsResponse | string) => void>();
  let idle: NodeJS.Timeout | undefined;
  const stopWhenIdle = (): void => {
    clearTimeout(idle);
    if (pending.size > 0) return;
    worker?.unref();
    idle = setTimeout(() => {
      const running = worker;
      worker = undefined;
      void running?.terminate();
    }, IDLE_MS);
    idle.unref();
  };
  const started = (): Worker => {
    clearTimeout(idle);
    if (worker !== undefined) return worker;
    const workerData: DocsWorkerData = { docsModule, readsEverything };
    const created = new Worker(WORKER_URL, {
      workerData,
      resourceLimits: {
        maxYoungGenerationSizeMb: readsEverything ? BUILD_YOUNG_GENERATION_MB : YOUNG_GENERATION_MB
      }
    });
    created.unref();
    created.on("message", (message: unknown): void => {
      if (!isDocsResponse(message)) return;
      pending.get(message.id)?.(message);
      pending.delete(message.id);
      stopWhenIdle();
    });
    // a worker that dies answers every request still waiting with why, and the next request starts a new one
    created.once("exit", (code: number): void => {
      for (const resolve of pending.values()) resolve(`The docs' worker stopped (${code})`);
      pending.clear();
      if (worker === created) worker = undefined;
    });
    worker = created;
    return created;
  };
  // a request's answer, or why the worker stopped before giving it
  const send = (request: DocsRequest, resolve: (response: DocsResponse | string) => void): void => {
    if (request.kind === "changed") return;
    pending.set(request.id, resolve);
    const running = started();
    // an answer on its way keeps the process alive; nothing else of the worker does
    running.ref();
    running.postMessage(request);
  };
  const extract = (storyFile: string, resolve: (result: DocsResult) => void): void => {
    const kept = docsCache?.read(storyFile);
    if (kept !== undefined) {
      resolve(kept);
      return;
    }
    send({ kind: "extract", id: nextId++, storyFile }, (response) => {
      if (typeof response === "string" || response.kind !== "extract") {
        resolve(String(response));
        return;
      }
      const { result, dependencies } = response;
      if (typeof result !== "string") docsCache?.write(storyFile, result, dependencies);
      resolve(result);
    });
  };
  return {
    extract: (storyFile: string): Promise<DocsResult> =>
      new Promise((resolve) => extract(storyFile, resolve)),
    usage: (files: readonly UsageRequestFile[]): Promise<UsageResult> =>
      new Promise((resolve) => {
        const key = files.map((file) => file.storyFile).join("\n");
        const kept = usageCache?.read(key);
        if (kept !== undefined) {
          resolve(kept);
          return;
        }
        send({ kind: "usage", id: nextId++, files }, (response) => {
          if (typeof response === "string" || response.kind !== "usage") {
            resolve(String(response));
            return;
          }
          const { result, dependencies } = response;
          if (typeof result !== "string") usageCache?.write(key, result, dependencies);
          resolve(result);
        });
      }),
    changed: (): void => {
      // a worker not started yet has no program to renew
      const request: DocsRequest = { kind: "changed" };
      worker?.postMessage(request);
    },
    close: async (): Promise<void> => {
      clearTimeout(idle);
      const running = worker;
      worker = undefined;
      if (running === undefined) return;
      await running.terminate();
    }
  };
};

/**
 * A docs extractor with its worker, started on its first request.
 *
 * @param docsModule - the URL of the framework's docs module (`FrameworkAdapter.docsModule`).
 * @param options - where answers are kept, and how it is used.
 * @returns the extractor.
 */
export const createDocsExtractor = (
  docsModule: string,
  options: DocsExtractorOptions = {}
): DocsExtractor => {
  const reader = readerOf(docsModule, options);
  // a build reads "Used in" in a worker of its own, beside the docs', on a machine with room for both: each reads every
  // file of the library, and one after the other they were most of a build's time (Fluent UI: about 2 GB more at the
  // peak); a dev server keeps one worker, which is lighter
  if (options.readsEverything !== true || !hasRoomForTwoReaders()) return reader;
  const usageReader = readerOf(docsModule, options);
  return {
    ...reader,
    usage: usageReader.usage,
    close: async (): Promise<void> => {
      await Promise.all([reader.close(), usageReader.close()]);
    }
  };
};
