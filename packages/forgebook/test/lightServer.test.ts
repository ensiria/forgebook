/**
 * Tests that a dev server's thread starts light: what the command and the plugin import at start reaches no compiler,
 * no highlighter and no Markdown reader; those load when a page or a command asks.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/** The modules that weigh on a server's start and memory, loaded only when asked. */
const HEAVY = ["typescript-6", "highlight.js", "marked"];

/** The modules a module imports when it loads: `import type` and `import()` leave none behind. */
const staticImports = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(/^(?:import|export) (?!type\b)[^;]*? from "([^"]+)";/gms)].flatMap(
    (match) => match[1] ?? []
  );

/** Every package reached from a module through its static relative imports. */
const reachedPackages = (entry: string): Set<string> => {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of staticImports(file)) {
      if (specifier.startsWith(".")) queue.push(resolve(dirname(file), specifier));
      else packages.add(specifier);
    }
  }
  return packages;
};

describe("the dev server's thread", () => {
  it("reaches no heavy module from the command or the plugin at start", () => {
    for (const entry of ["../bin/forgebook/forgebookCommands.mts", "../src/vite/forgebookPlugin.ts"]) {
      const packages = [...reachedPackages(resolve(import.meta.dirname, entry))];
      expect(packages.filter((name) => HEAVY.some((heavy) => name.startsWith(heavy)))).toEqual([]);
    }
  });

  it("reads the command's modules through its entry, which turns the compile cache on first", () => {
    const entry = readFileSync(resolve(import.meta.dirname, "../bin/forgebook/forgebook.mts"), "utf8");
    expect(staticImports(resolve(import.meta.dirname, "../bin/forgebook/forgebook.mts"))).toEqual([
      "node:module",
      "./compileCache.ts"
    ]);
    expect(entry.indexOf("enableCompileCache(")).toBeLessThan(
      entry.indexOf('import("./forgebookCommands.mts")')
    );
  });
});
