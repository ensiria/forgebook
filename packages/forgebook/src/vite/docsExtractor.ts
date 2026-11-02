/**
 * The story files' component docs, and the facts "Used in" is joined from (`usageGraph.ts`), read in a worker thread
 * (`docsWorker.ts`) so the dev server keeps answering while a package's TypeScript program is built.
 *
 * @remarks
 * One worker per plugin, started on the first request and kept: its programs make every later read quick, until a
 * source file changes (`changed`, which the dev server's watcher sends). Nothing starts it ahead of a request: a
 * TypeScript program is two thirds of the server's memory, and a story's page never reads one. Requests are answered
 * in order. The worker never keeps the process alive (`unref`), and `close` ends it when the build or the server ends.
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
  // every request sent and not answered yet
  const pending = new Map<number, (response: DocsResponse | string) => void>();
  const started = (): Worker => {
    if (worker !== undefined) return worker;
    const workerData: DocsWorkerData = { docsModule };
    const created = new Worker(WORKER_URL, { workerData });
    created.unref();
    created.on("message", (response: DocsResponse): void => {
      pending.get(response.id)?.(response);
      pending.delete(response.id);
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
    changed: (): void => {
      // a worker not started yet has no program to renew
      const request: DocsRequest = { kind: "changed" };
      worker?.postMessage(request);
    },
    close: async (): Promise<void> => {
      const running = worker;
      worker = undefined;
      await running?.terminate();
    }
  };
};
