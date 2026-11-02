/**
 * Tests for the dev plugin that runs React's Fast Refresh after the update's task: the runtime `@vitejs/plugin-react`
 * serves is changed, and its refresh runs once for every call made in one task.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { refreshedAtOnce } from "../src/vite/refreshAtOnce.ts";

/** The refresh runtime of the installed `@vitejs/plugin-react`. */
const runtime = (): string => {
  const entry = createRequire(import.meta.url).resolve("@vitejs/plugin-react");
  return readFileSync(join(dirname(entry), "refresh-runtime.js"), "utf8");
};

describe("refreshedAtOnce", () => {
  it("changes the installed runtime's 16 ms wait into a wait for the end of the task", () => {
    const changed = refreshedAtOnce(runtime());
    expect(changed).toBeDefined();
    expect(changed).toContain("const enqueueUpdate = forgebookAfterTask(async () => {");
    expect(changed).not.toContain("}, 16)");
  });

  it("leaves a runtime it does not know as it is", () => {
    expect(refreshedAtOnce("const enqueueUpdate = debounce(fn, 30)")).toBeUndefined();
  });

  it("refreshes once for every call made in one task, right after it", async () => {
    const changed = refreshedAtOnce(runtime()) ?? "";
    const helper = changed.slice(changed.indexOf("function forgebookAfterTask"));
    // the runtime's own text, run as the page runs it: two calls in one task, then the count before and after the task
    const counts: unknown = await new Function(
      `${helper}; let runs = 0; const enqueue = forgebookAfterTask(() => { runs += 1 }); enqueue(); enqueue();` +
        "const before = runs; return Promise.resolve().then(() => [before, runs]);"
    )();
    expect(counts).toEqual([0, 1]);
  });
});
