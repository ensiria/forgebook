/**
 * Tests for JSX in a project's `.js` files with React's adapter, through Forgebook's plugin and React's own: a static
 * build compiles a component's JSX, and a `?raw` import of the same file stays its text.
 *
 * @module
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { forgebookPlugin } from "forgebook/vite";
import { build, type Rollup } from "vite";
import { afterAll, describe, expect, it } from "vitest";

import { react } from "../src/vite/react.ts";

// inside the package, so React and the plugins resolve to its installed dependencies
const ROOT = mkdtempSync(join(import.meta.dirname, ".jsx-in-js-"));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/** The code of a build's chunks, joined. */
const chunksOf = (output: Awaited<ReturnType<typeof build>>): string => {
  const outputs = Array.isArray(output) ? output : [output];
  return outputs
    .flatMap((each): readonly (Rollup.OutputChunk | Rollup.OutputAsset)[] =>
      "output" in each ? each.output : []
    )
    .map((each) => (each.type === "chunk" ? each.code : ""))
    .join("\n");
};

describe("JSX in .js files with React's adapter", () => {
  it("is compiled by a static build, and a ?raw import of the file keeps its text", async () => {
    writeFileSync(join(ROOT, "package.json"), '{ "type": "module" }');
    writeFileSync(
      join(ROOT, "Card.js"),
      'export const Card = ({ title }) => <p className="card">{title}</p>;\n'
    );
    writeFileSync(
      join(ROOT, "entry.js"),
      'export { Card } from "./Card.js";\nexport { default as cardText } from "./Card.js?raw";\n'
    );
    const adapter = react();
    const output = await build({
      root: ROOT,
      configFile: false,
      logLevel: "silent",
      plugins: [forgebookPlugin({ framework: adapter }), ...((await adapter.vitePlugins?.()) ?? [])],
      build: {
        write: false,
        minify: false,
        lib: { entry: join(ROOT, "entry.js"), formats: ["es"] },
        rolldownOptions: { external: [/^react/] }
      }
    });
    const code = chunksOf(output);
    expect(code).toMatch(/react\/jsx-(dev-)?runtime/);
    // the raw text, with its JSX, as a string
    expect(code).toContain('<p className=\\"card\\">{title}</p>');
  });
});
