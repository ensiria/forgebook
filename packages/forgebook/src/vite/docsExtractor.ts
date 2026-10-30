/**
 * The story files' component docs, read in a worker thread (`docsWorker.ts`) so the dev server keeps answering while
 * a package's TypeScript program is built.
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
import { Worker } from "node:worker_threads";

import type { StoryComponentResult } from "./adapter.ts";

/** What the extractor answers for a story file: its component's docs, none, or why it cannot be read. */
export type DocsResult = StoryComponentResult;

/** A message to the worker: a story file's docs to read, or the news that a source file changed. */
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
      /** A source file changed: the programs are renewed on their next read. */
      readonly kind: "changed";
    };

/** The worker's answer to a request. */
export type DocsResponse = {
  /** The request's number. */
  readonly id: number;
  /** The extractor's result. */
  readonly result: DocsResult;
};

/** The docs, read off the dev server's thread. */
export type DocsExtractor = {
  /** The component docs of a story file. */
  readonly extract: (storyFile: string) => Promise<DocsResult>;
  /** Builds the program that holds a story file, ahead of its first read. */
  readonly warm: (storyFile: string) => void;
  /** Tells the worker a source file changed, so the next read sees it. */
  readonly changed: () => void;
  /** Ends the worker; a later request starts a new one. */
  readonly close: () => Promise<void>;
};

/** The worker's module, beside this one; Node strips its types as it does this file's. */
const WORKER_URL = new URL("./docsWorker.ts", import.meta.url);

/** What the worker is started with: the framework's docs module, which it loads before its first answer. */
export type DocsWorkerData = {
  /** The URL of the module exporting the framework's `extractStoryComponent`. */
  readonly docsModule: string;
};

/**
 * A docs extractor with its worker, started on its first request.
 *
 * @param docsModule - the URL of the framework's docs module (`FrameworkAdapter.docsModule`).
 * @returns the extractor.
 */
export const createDocsExtractor = (docsModule: string): DocsExtractor => {
  let worker: Worker | undefined;
  let nextId = 0;
  // every request sent and not answered yet, a warm-up's answer included (none reads it)
  const pending = new Map<number, (result: DocsResult) => void>();
  // the warm-ups not sent yet: one goes out only when nothing is pending
  const warmUps: string[] = [];
  const started = (): Worker => {
    if (worker !== undefined) return worker;
    const workerData: DocsWorkerData = { docsModule };
    const created = new Worker(WORKER_URL, { workerData });
    created.unref();
    created.on("message", (response: DocsResponse): void => {
      pending.get(response.id)?.(response.result);
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
  const send = (storyFile: string, resolve: (result: DocsResult) => void): void => {
    const id = nextId++;
    pending.set(id, resolve);
    const request: DocsRequest = { kind: "extract", id, storyFile };
    started().postMessage(request);
  };
  const sendWarmUp = (): void => {
    if (pending.size > 0) return;
    const storyFile = warmUps.shift();
    if (storyFile !== undefined) send(storyFile, () => undefined);
  };
  return {
    extract: (storyFile: string): Promise<DocsResult> => new Promise((resolve) => send(storyFile, resolve)),
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
