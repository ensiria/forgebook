/**
 * The worker thread that reads the story files' component docs: TypeScript's program for a package takes seconds to
 * build, and built on the dev server's own thread it held every other answer (a frame, a documentation file) until
 * it was done.
 *
 * @remarks
 * Started by `docsExtractor.ts` with the framework's docs module (`adapter.ts`), which it loads once; it keeps the
 * programs of `docsProgram.ts` between requests, so only a package's first
 * read builds one, and a changed source file (`{ kind: "changed" }`) renews them on their next read. A usage request
 * (`{ kind: "usage", id, files }`) is answered from the same programs (`usageGraph.ts`). A request is `{ id, storyFile }`, the answer `{ id, result }`, `extractStoryComponent`'s result as
 * it is (plain data), with the files it can change with (`docsDependencies.ts`), which the dev server keeps it on disk
 * with. Unasked, it says `{ kind: "loaded" }` once its modules are loaded.
 *
 * @module
 */
import { parentPort, workerData } from "node:worker_threads";

import { type DocsModule, isDocsModule } from "./adapter.ts";
import { isSettledSince, nowNs, type PathStamp, stampPaths } from "./diskCache.ts";
import { docsDependencies } from "./docsDependencies.ts";
import type {
  DocsRequest,
  DocsResponse,
  DocsResult,
  DocsWorkerData,
  DocsWorkerLoaded
} from "./docsExtractor.ts";
import { markSourcesChanged, readAskedFilesOnly } from "./docsProgram.ts";
import { usageGraph } from "./usageGraph.ts";

/** Whether the worker's data names a docs module. */
const isWorkerData = (value: unknown): value is DocsWorkerData =>
  typeof value === "object" &&
  value !== null &&
  "docsModule" in value &&
  typeof value.docsModule === "string" &&
  "readsEverything" in value &&
  typeof value.readsEverything === "boolean" &&
  "keepsAnswers" in value &&
  typeof value.keepsAnswers === "boolean";

/** The framework's docs module, or why it could not be loaded: every request is then answered with that. */
const loadDocsModule = async (): Promise<DocsModule | string> => {
  if (!isWorkerData(workerData)) return "The docs' worker was started without a docs module";
  try {
    const module: unknown = await import(workerData.docsModule);
    if (isDocsModule(module)) return module;
    return `${workerData.docsModule} exports no extractStoryComponent`;
  } catch (error) {
    return `${workerData.docsModule} could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
  }
};

// a dev server shows one component at a time: its programs hold what was asked for, not every file of a package
if (isWorkerData(workerData) && !workerData.readsEverything) readAskedFilesOnly();

/** The framework's docs module, loaded once, before the first answer. */
const docsModule = loadDocsModule();

// the extractor waits for this before it ends the thread: `endOnceLoaded` says why
void docsModule.then((): void => {
  const loaded: DocsWorkerLoaded = { kind: "loaded" };
  parentPort?.postMessage(loaded);
});

/** The extractor's result, or why it threw: a throw would end the worker and every request waiting on it. */
const extracted = async (storyFile: string): Promise<DocsResult> => {
  const module = await docsModule;
  if (typeof module === "string") return module;
  try {
    return module.extractStoryComponent(storyFile);
  } catch (error) {
    return `${storyFile}: the docs could not be read: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/** A group of story files' usage, or why it threw: a throw would end the worker and every request waiting on it. */
const usage = (files: Parameters<typeof usageGraph>[0]): ReturnType<typeof usageGraph> => {
  try {
    return usageGraph(files);
  } catch (error) {
    return `The stories' usage could not be read: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * The stamps an answer is kept with: its story files' dependencies as they are now, or none when one changed since the
 * answer's making started, which may then hold what the file was before.
 *
 * @param storyFiles - the story files read.
 * @param since - when the reading started.
 */
const keptStamps = (storyFiles: readonly string[], since: bigint): readonly PathStamp[] | undefined => {
  // a worker whose answers are not kept (a build's) does not walk their files
  if (!isWorkerData(workerData) || !workerData.keepsAnswers) return undefined;
  const stamps = stampPaths(docsDependencies(storyFiles));
  return isSettledSince(stamps, since) ? stamps : undefined;
};

parentPort?.on("message", (request: DocsRequest): void => {
  if (request.kind === "changed") {
    markSourcesChanged();
    void docsModule.then((module): void => {
      if (typeof module !== "string") module.sourcesChanged?.();
    });
    return;
  }
  if (request.kind === "usage") {
    const since = nowNs();
    const result = usage(request.files);
    const stamps =
      typeof result === "string"
        ? undefined
        : keptStamps(
            request.files.map((file) => file.storyFile),
            since
          );
    const response: DocsResponse = { kind: "usage", id: request.id, result, stamps };
    parentPort?.postMessage(response);
    return;
  }
  const since = nowNs();
  void extracted(request.storyFile).then((result) => {
    const stamps = typeof result === "string" ? undefined : keptStamps([request.storyFile], since);
    const response: DocsResponse = { kind: "extract", id: request.id, result, stamps };
    parentPort?.postMessage(response);
  });
});
