/**
 * The worker thread that reads the story files' component docs: TypeScript's program for a package takes seconds to
 * build, and built on the dev server's own thread it held every other answer (a frame, a documentation file) until
 * it was done.
 *
 * @remarks
 * Started by `docsExtractor.ts`; it keeps the programs of `docsProgram.ts` between requests, so only a package's first
 * read builds one, and a changed source file (`{ kind: "changed" }`) renews them on their next read. A request is `{ id, storyFile }`, the answer `{ id, result }`, `extractStoryComponent`'s result as
 * it is (plain data); a warm-up is a request whose answer nobody reads.
 *
 * @module
 */
import { parentPort } from "node:worker_threads";

import type { DocsRequest, DocsResponse } from "./docsExtractor.ts";
import { markSourcesChanged } from "./docsProgram.ts";
import { extractStoryComponent } from "./extractDocs.ts";

/** The extractor's result, or why it threw: a throw would end the worker and every request waiting on it. */
const extracted = (storyFile: string): DocsResponse["result"] => {
  try {
    return extractStoryComponent(storyFile);
  } catch (error) {
    return `${storyFile}: the docs could not be read: ${error instanceof Error ? error.message : String(error)}`;
  }
};

parentPort?.on("message", (request: DocsRequest): void => {
  if (request.kind === "changed") {
    markSourcesChanged();
    return;
  }
  const response: DocsResponse = { id: request.id, result: extracted(request.storyFile) };
  parentPort?.postMessage(response);
});
