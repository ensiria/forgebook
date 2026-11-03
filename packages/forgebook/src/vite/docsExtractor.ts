/**
 * The story files' component docs, and the facts "Used in" is joined from (`usageGraph.ts`), read in a worker thread
 * (`docsWorker.ts`) so the dev server keeps answering while a package's TypeScript program is built.
 *
 * @remarks
 * One worker per plugin, started on the first request and kept: its programs make every later read quick, until a
 * source file changes (`changed`, which the dev server's watcher sends). Requests
 * are answered in order; a warm-up (`warm`) builds a package's program before a page asks for it, one at a time and
 * only while the worker has nothing else to do, so a page's request waits behind one warm-up at most, never behind
 * them all. The worker never keeps the process alive (`unref`), and `close` ends it when the build or the server
 * ends.
 *
 * @module
 */
import { extname } from "node:path";
import { Worker } from "node:worker_threads";

import type { StoryComponentResult } from "./adapter.ts";
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
    }
  | {
      /** A group of story files' usage. */
      readonly kind: "usage";
      /** The request's number. */
      readonly id: number;
      /** The facts, or why they cannot be read. */
      readonly result: UsageResult;
    };

/** The docs, read off the dev server's thread. */
export type DocsExtractor = {
  /** The component docs of a story file. */
  readonly extract: (storyFile: string) => Promise<DocsResult>;
  /** What a group of story files' stories render, and the import graph they reach. */
  readonly usage: (files: readonly UsageRequestFile[]) => Promise<UsageResult>;
  /** Builds the program that holds a story file, ahead of its first read. */
  readonly warm: (storyFile: string) => void;
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

/** What the worker is started with: the framework's docs module, which it loads before its first answer. */
export type DocsWorkerData = {
  /** The URL of the module exporting the framework's `extractStoryComponent`. */
  readonly docsModule: string;
  /**
   * Whether every story's docs will be read, as in a build: each program then holds its whole configuration at once,
   * rather than what was asked for so far, which a dev server showing one component at a time needs.
   */
  readonly readsEverything: boolean;
};

/** How an extractor reads. */
export type DocsExtractorOptions = {
  /** Whether every story's docs will be read, as in a build; a dev server's reads by default. */
  readonly readsEverything?: boolean;
};

/**
 * The worker's young generation on a dev server, in MB. V8 sizes it for throughput, but a program's heap survives
 * its collections, so a large young generation is mostly empty memory the worker keeps; a dev server reads one
 * component at a time, where collecting more often costs little.
 */
const YOUNG_GENERATION_MB = 8;

/**
 * The worker's young generation in a build, in MB: a build reads every story's docs in one go, and with the dev
 * server's small one it would spend much of that time collecting garbage.
 */
const BUILD_YOUNG_GENERATION_MB = 64;

/**
 * A docs extractor with its worker, started on its first request.
 *
 * @param docsModule - the URL of the framework's docs module (`FrameworkAdapter.docsModule`).
 * @param options - how it reads.
 * @returns the extractor.
 */
export const createDocsExtractor = (
  docsModule: string,
  { readsEverything = false }: DocsExtractorOptions = {}
): DocsExtractor => {
  let worker: Worker | undefined;
  let nextId = 0;
  // every request sent and not answered yet, a warm-up's answer included (none reads it)
  const pending = new Map<number, (response: DocsResponse | string) => void>();
  // the warm-ups not sent yet: one goes out only when nothing is pending
  const warmUps: string[] = [];
  const started = (): Worker => {
    if (worker !== undefined) return worker;
    const workerData: DocsWorkerData = { docsModule, readsEverything };
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
    });
    // a worker that dies answers every request still waiting with why, and the next request starts a new one
    created.on("error", (error: Error): void => {
      for (const resolve of pending.values()) resolve(`The docs' worker stopped: ${error.message}`);
      pending.clear();
      worker = undefined;
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
  const extract = (storyFile: string, resolve: (result: DocsResult) => void): void =>
    send({ kind: "extract", id: nextId++, storyFile }, (response) =>
      resolve(
        typeof response === "string" || response.kind !== "extract" ? String(response) : response.result
      )
    );
  const sendWarmUp = (): void => {
    if (pending.size > 0) return;
    const storyFile = warmUps.shift();
    if (storyFile !== undefined) extract(storyFile, () => undefined);
  };
  return {
    extract: (storyFile: string): Promise<DocsResult> =>
      new Promise((resolve) => extract(storyFile, resolve)),
    usage: (files: readonly UsageRequestFile[]): Promise<UsageResult> =>
      new Promise((resolve) =>
        send({ kind: "usage", id: nextId++, files }, (response) =>
          resolve(
            typeof response === "string" || response.kind !== "usage" ? String(response) : response.result
          )
        )
      ),
    warm: (storyFile: string): void => {
      warmUps.push(storyFile);
      sendWarmUp();
    },
    changed: (): void => {
      // a worker not started yet has no program to renew
      const request: DocsRequest = { kind: "changed" };
      worker?.postMessage(request);
    },
    close: async (): Promise<void> => {
      const running = worker;
      worker = undefined;
      warmUps.length = 0;
      await running?.terminate();
    }
  };
};
