/**
 * Tests for JSX in a project's `.js` files: compiled with the project's JSX options, any other module left to Vite,
 * and read as JSX by Vite's dependency scan.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { optimizeDeps, resolveConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";

import { jsxInScript, jsxInScripts, mayHoldJsx } from "../src/vite/jsxInScripts.ts";
import { scanOptions } from "../src/vite/prebundled.ts";

// inside the package, so the files' imports resolve to its installed dependencies
const ROOT = mkdtempSync(join(import.meta.dirname, ".jsx-in-js-"));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

const CARD = 'export const Card = ({ title }) => <p className="card">{title}</p>;\n';

describe("mayHoldJsx", () => {
  it("takes the project's .js files with a closing tag, and nothing else", () => {
    expect(mayHoldJsx("/app/src/Card.js", CARD)).toBe(true);
    expect(mayHoldJsx("/app/src/Card.mjs?v=1", "const a = <br />;")).toBe(true);
    expect(mayHoldJsx("/app/src/plain.js", "export const isLess = (a, b) => a < b;\n")).toBe(false);
    expect(mayHoldJsx("/app/src/Card.jsx", CARD)).toBe(false);
    expect(mayHoldJsx("/app/src/Card.ts", CARD)).toBe(false);
    expect(mayHoldJsx("/app/node_modules/lib/Card.js", CARD)).toBe(false);
    expect(mayHoldJsx("\0virtual:card.js", CARD)).toBe(false);
  });
});

describe("jsxInScript", () => {
  it("compiles a .js file's JSX with the project's JSX options, and leaves the others to Vite", async () => {
    const config = await resolveConfig(
      {
        root: ROOT,
        configFile: false,
        logLevel: "silent",
        oxc: { jsx: { runtime: "automatic", importSource: "preact" } }
      },
      "serve"
    );
    const compiled = await jsxInScript(config, CARD, join(ROOT, "Card.js"));
    expect(compiled?.code).toContain("preact/jsx-");
    expect(compiled?.code).not.toContain("<p");
    expect(compiled?.map).toBeTruthy();
    expect(await jsxInScript(config, "export const a = 1;\n", join(ROOT, "plain.js"))).toBeNull();
    const off = await resolveConfig(
      { root: ROOT, configFile: false, logLevel: "silent", oxc: false },
      "serve"
    );
    expect(await jsxInScript(off, CARD, join(ROOT, "Card.js"))).toBeNull();
  });

  it("names the file and line of JSX that does not parse", async () => {
    const config = await resolveConfig({ root: ROOT, configFile: false, logLevel: "silent" }, "serve");
    await expect(jsxInScript(config, "const a = <p>;\n</div>", join(ROOT, "Bad.js"))).rejects.toThrow(
      /Bad\.js/
    );
  });
});

describe("jsxInScripts", () => {
  it("loads a .js file's JSX compiled once Vite's configuration is known, and only when the framework asks", async () => {
    const file = join(ROOT, "Loaded.js");
    writeFileSync(file, CARD);
    let isAsked = true;
    const hooks = jsxInScripts(() => isAsked);
    expect(await hooks.load(file)).toBeNull();
    hooks.remember(await resolveConfig({ root: ROOT, configFile: false, logLevel: "silent" }, "serve"));
    expect((await hooks.load(`${file}?v=1`))?.code).not.toContain("<p");
    expect(await hooks.load(join(ROOT, "Missing.js"))).toBeNull();
    isAsked = false;
    expect(await hooks.load(file)).toBeNull();
  });
});

describe("Vite's dependency scan", () => {
  it("finds what .js files holding JSX import", async () => {
    mkdirSync(join(ROOT, "src"));
    writeFileSync(
      join(ROOT, "src/Card.js"),
      `import { marked } from "marked";\n${CARD}export const md = marked;\n`
    );
    writeFileSync(
      join(ROOT, "src/Card.stories.js"),
      'import { Card } from "./Card";\nexport default { component: Card };\nexport const Main = { render: () => <Card title="a" /> };\n'
    );
    const config = await resolveConfig(
      {
        root: ROOT,
        configFile: false,
        logLevel: "silent",
        cacheDir: join(ROOT, ".vite"),
        optimizeDeps: { entries: ["src/*.stories.js"], rolldownOptions: scanOptions() }
      },
      "serve"
    );
    const metadata = await optimizeDeps(config, true);
    expect(Object.keys(metadata.optimized)).toContain("marked");
  });
});
