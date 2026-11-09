/**
 * Tests for the wrapper the catalogue's plugin puts around a module's `import()`: what is wrapped, what is left as it
 * is, and that the module still runs where no frame tracks anything.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { withTrackedImports } from "../src/vite/trackedImports.ts";

describe("a module's dynamic imports, for the frame", () => {
  it("wraps each call, nested ones too, and keeps every line where it was", () => {
    const code = `const a = () => import("./A.js");\nconst b = import(\`./\${name}.js\`).then(() => import("./C.js"));\n`;
    const written = withTrackedImports(code) ?? "";
    expect(written).toContain('const a = () => __forgebookTrackImport(import("./A.js"));');
    expect(written).toContain(
      `const b = __forgebookTrackImport(import(\`./\${name}.js\`)).then(() => __forgebookTrackImport(import("./C.js")));`
    );
    // the wrapper's declaration goes after the module's last line
    expect(written.split("\n").slice(0, 3)).toHaveLength(3);
    expect(written.split("\n")[1]).toMatch(/^const b/);
    expect(written.split("\n")[3]).toMatch(/^function __forgebookTrackImport/);
  });

  it("leaves a module without one, a comment or a string with the word, and one that does not parse", () => {
    expect(withTrackedImports("export const a = 1;")).toBeUndefined();
    expect(withTrackedImports('// import("./A.js")\nconst s = "import(x)";')).toBeUndefined();
    expect(withTrackedImports("const = import(")).toBeUndefined();
  });

  it("runs as before where nothing tracks, and hands each promise to the tracker where something does", async () => {
    const written =
      withTrackedImports('export const load = () => import("data:text/javascript,export default 7");') ?? "";
    const url = `data:text/javascript,${encodeURIComponent(written)}`;
    const module: { readonly load: () => Promise<{ readonly default: number }> } = await import(
      /* @vite-ignore */ url
    );
    expect((await module.load()).default).toBe(7);
    const seen: unknown[] = [];
    const key = Symbol.for("forgebook.startedImports");
    const holder = globalThis as unknown as Record<symbol, unknown>;
    holder[key] = (loading: Promise<unknown>): Promise<unknown> => {
      seen.push(loading);
      return loading;
    };
    try {
      expect((await module.load()).default).toBe(7);
      expect(seen).toHaveLength(1);
    } finally {
      delete holder[key];
    }
  });
});
