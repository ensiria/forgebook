/**
 * Tests for the code loader of a component whose stories come from several files.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { filesCodeLoader } from "../src/shell/filesCode.ts";

/** A file's code as the plugin answers it: each story's text and HTML, by export. */
const codeOf = (...exports: readonly string[]): Record<string, { text: string; html: string }> =>
  Object.fromEntries(exports.map((name) => [name, { text: name, html: name }]));

describe("filesCodeLoader", () => {
  const loaders = {
    "./a.stories.tsx": () => Promise.resolve(codeOf("Overview", "Shared")),
    "./b.stories.tsx": () => Promise.resolve({ ...codeOf("Playground"), Shared: { text: "b", html: "b" } })
  };

  it("gives a component in one file its source's own loader", () => {
    expect(filesCodeLoader(loaders, ["./a.stories.tsx"])).toBe(loaders["./a.stories.tsx"]);
    expect(filesCodeLoader(loaders, ["./missing.stories.tsx"])).toBeUndefined();
  });

  it("loads every file's code as one, a story of an earlier file winning, and keeps the loader", async () => {
    const load = filesCodeLoader(loaders, ["./a.stories.tsx", "./b.stories.tsx"]);
    expect(await load?.()).toEqual({
      ...codeOf("Overview", "Playground"),
      Shared: { text: "Shared", html: "Shared" }
    });
    // the page loads the code again whenever its loader changes
    expect(filesCodeLoader(loaders, ["./a.stories.tsx", "./b.stories.tsx"])).toBe(load);
  });
});
