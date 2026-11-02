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
 * it is (plain data).
 *
 * @module
 */
import { parentPort, workerData } from "node:worker_threads";

import { type ExtractStoryComponent, isDocsModule } from "./adapter.ts";
import type { DocsRequest, DocsResponse, DocsResult, DocsWorkerData } from "./docsExtractor.ts";
import { markSourcesChanged, readAskedFilesOnly } from "./docsProgram.ts";
import { docsDependencies, usageGraph } from "./usageGraph.ts";

/** Whether the worker's data names a docs module. */
const isWorkerData = (value: unknown): value is DocsWorkerData =>
  typeof value === "object" &&
  value !== null &&
  "docsModule" in value &&
  typeof value.docsModule === "string";

/** The framework's extractor, or why it could not be loaded: every request is then answered with that. */
const loadExtractor = async (): Promise<ExtractStoryComponent | string> => {
  if (!isWorkerData(workerData)) return "The docs' worker was started without a docs module";
  try {
    const module: unknown = await import(workerData.docsModule);
    if (isDocsModule(module)) return module.extractStoryComponent;
    return `${workerData.docsModule} exports no extractStoryComponent`;
  } catch (error) {
    return `${workerData.docsModule} could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
  }
};

readAskedFilesOnly();

/** The framework's extractor, loaded once, before the first answer. */
const extractor = loadExtractor();

/** The extractor's result, or why it threw: a throw would end the worker and every request waiting on it. */
const extracted = async (storyFile: string): Promise<DocsResult> => {
  const extract = await extractor;
  if (typeof extract === "string") return extract;
  try {
    return extract(storyFile);
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

parentPort?.on("message", (request: DocsRequest): void => {
  if (request.kind === "changed") {
    markSourcesChanged();
    return;
  }
  if (request.kind === "usage") {
    const response: DocsResponse = { kind: "usage", id: request.id, result: usage(request.files) };
    parentPort?.postMessage(response);
    return;
  }
  void extracted(request.storyFile).then((result) => {
    const dependencies = typeof result === "string" ? [] : docsDependencies(request.storyFile);
    const response: DocsResponse = { kind: "extract", id: request.id, result, dependencies };
    parentPort?.postMessage(response);
  });
});
