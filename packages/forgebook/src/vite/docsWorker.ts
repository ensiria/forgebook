/**
 * The process that reads the story files' component docs: TypeScript's program for a package takes seconds to
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

import { type DocsModule, isDocsModule } from "./adapter.ts";
import type { DocsRequest, DocsResponse, DocsResult, DocsWorkerData } from "./docsExtractor.ts";
import { markSourcesChanged, readAskedFilesOnly } from "./docsProgram.ts";
import { docsDependencies, usageDependencies, usageGraph } from "./usageGraph.ts";

/** What the extractor started this process with, as JSON. */
const workerData: unknown = JSON.parse(process.argv[2] ?? "null");

/** Answers the extractor, while it is there to read it. */
const answer = (response: DocsResponse): void => {
  process.send?.(response);
};

// a server that dies leaves nobody to send a request, or to end this process
process.once("disconnect", () => process.exit());

/** Whether the worker's data names a docs module. */
const isWorkerData = (value: unknown): value is DocsWorkerData =>
  typeof value === "object" &&
  value !== null &&
  "docsModule" in value &&
  typeof value.docsModule === "string";

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

// a build reads every story file: a program of the files asked so far would only be built again and again
if (isWorkerData(workerData) && !workerData.readsEverything) readAskedFilesOnly();

/** The framework's docs module, loaded once, before the first answer. */
const docsModule = loadDocsModule();

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

process.on("message", (request: DocsRequest): void => {
  if (request.kind === "changed") {
    markSourcesChanged();
    void docsModule.then((module): void => {
      if (typeof module !== "string") module.sourcesChanged?.();
    });
    return;
  }
  if (request.kind === "usage") {
    const result = usage(request.files);
    const dependencies = typeof result === "string" ? [] : usageDependencies(request.files);
    const response: DocsResponse = { kind: "usage", id: request.id, result, dependencies };
    answer(response);
    return;
  }
  void extracted(request.storyFile).then((result) => {
    // what the framework itself says it read counts too: a `.vue` file is no import TypeScript follows
    const read = typeof result !== "string" && "sources" in result ? result.sources : [];
    const dependencies = typeof result === "string" ? [] : [...docsDependencies(request.storyFile), ...read];
    const response: DocsResponse = { kind: "extract", id: request.id, result, dependencies };
    answer(response);
  });
});
