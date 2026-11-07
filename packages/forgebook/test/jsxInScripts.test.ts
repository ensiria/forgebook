/**
 * Tests for JSX in a project's `.js` files: compiled with the project's JSX options, any other module left to Vite,
 * and read as JSX by Vite's dependency scan.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, win32 } from "node:path";

import { optimizeDeps, resolveConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";

import {
  jsxInScript,
  jsxInScripts,
  mayHoldJsx,
  ownScriptOf,
  packageFinder
} from "../src/vite/jsxInScripts.ts";
import { scanOptions } from "../src/vite/prebundled.ts";
import { VITE_PATHS, vitePathsOf } from "../src/vite/vitePaths.ts";

// inside the package, so the files' imports resolve to its installed dependencies
const ROOT = mkdtempSync(join(import.meta.dirname, ".jsx-in-js-"));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/** Vite's paths on Windows. */
const WINDOWS = vitePathsOf(win32);

const CARD = 'export const Card = ({ title }) => <p className="card">{title}</p>;\n';

describe("ownScriptOf", () => {
  /** Packages by folder: the catalogue at `/repo/app`, a workspace package at `/repo/app/packages/ui`. */
  const packageOf = (file: string): string | undefined => {
    if (file.startsWith("/repo/app/packages/ui/")) return "/repo/app/packages/ui";
    return file.startsWith("/repo/app/") ? "/repo/app" : "/repo";
  };

  it("takes the catalogue's own .js files asked for as modules, and nothing else", () => {
    expect(ownScriptOf("/repo/app/src/Card.js", "/repo/app", packageOf)).toBe("/repo/app/src/Card.js");
    expect(ownScriptOf("/repo/app/src/Card.mjs?v=1a2b", "/repo/app", packageOf)).toBe(
      "/repo/app/src/Card.mjs"
    );
    expect(ownScriptOf("/repo/app/src/Card.js?t=123&import", "/repo/app", packageOf)).toBe(
      "/repo/app/src/Card.js"
    );
    for (const query of ["raw", "url", "inline", "worker", "worker&url", "v=1&raw"]) {
      expect(ownScriptOf(`/repo/app/src/Card.js?${query}`, "/repo/app", packageOf)).toBeUndefined();
    }
    expect(ownScriptOf("/repo/app/src/Card.jsx", "/repo/app", packageOf)).toBeUndefined();
    expect(ownScriptOf("/repo/app/node_modules/lib/Card.js", "/repo/app", packageOf)).toBeUndefined();
    // a workspace package's files keep their own build and source maps
    expect(ownScriptOf("/repo/app/packages/ui/dist/index.js", "/repo/app", packageOf)).toBeUndefined();
    expect(ownScriptOf("/repo/lib/index.js", "/repo/app", packageOf)).toBeUndefined();
    expect(ownScriptOf("\0virtual:card.js", "/repo/app", packageOf)).toBeUndefined();
  });

  it("reads Windows ids, with a drive and either slash", () => {
    const windows = (file: string): string => (file.startsWith("C:/app/") ? "C:/app" : "C:/");
    expect(ownScriptOf("C:/app/src/Card.js?v=1", "C:/app", windows, WINDOWS)).toBe("C:/app/src/Card.js");
    expect(ownScriptOf("C:\\app\\src\\Card.js", "C:/app", windows, WINDOWS)).toBe("C:/app/src/Card.js");
    expect(ownScriptOf("C:/app/node_modules/x/Card.js", "C:/app", windows, WINDOWS)).toBeUndefined();
  });

  it("finds a file's package on disk", () => {
    writeFileSync(join(ROOT, "package.json"), "{}");
    mkdirSync(join(ROOT, "nested/inner"), { recursive: true });
    writeFileSync(join(ROOT, "nested/package.json"), "{}");
    const root = VITE_PATHS.normalize(ROOT);
    const find = packageFinder();
    expect(find(`${root}/Card.js`)).toBe(root);
    expect(find(`${root}/nested/inner/Card.js`)).toBe(`${root}/nested`);
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
    expect(mayHoldJsx("export const isLess = (a, b) => a < b;\n")).toBe(false);
    expect(await jsxInScript(config, "export const a = 1;\n", join(ROOT, "plain.js"))).toBeNull();
    const off = await resolveConfig(
      { root: ROOT, configFile: false, logLevel: "silent", oxc: false },
      "serve"
    );
    expect(await jsxInScript(off, CARD, join(ROOT, "Card.js"))).toBeNull();
  });

  it("puts the project's jsxInject first, as Vite does for .jsx files", async () => {
    const config = await resolveConfig(
      {
        root: ROOT,
        configFile: false,
        logLevel: "silent",
        oxc: { jsx: { runtime: "classic" }, jsxInject: 'import React from "react"' }
      },
      "serve"
    );
    const compiled = await jsxInScript(config, CARD, join(ROOT, "Card.js"));
    expect(compiled?.code.startsWith('import React from "react";')).toBe(true);
    expect(compiled?.code).toContain("React.createElement");
  });

  it("names the file and line of JSX that does not parse", async () => {
    const config = await resolveConfig({ root: ROOT, configFile: false, logLevel: "silent" }, "serve");
    await expect(jsxInScript(config, "const a = <p>;\n</div>", join(ROOT, "Bad.js"))).rejects.toThrow(
      /Bad\.js/
    );
  });
});

describe("jsxInScripts", () => {
  it("loads an own .js file's JSX compiled once Vite's configuration is known, and only when the framework asks", async () => {
    writeFileSync(join(ROOT, "package.json"), "{}");
    const file = join(ROOT, "Loaded.js");
    writeFileSync(file, CARD);
    let isAsked = true;
    const hooks = jsxInScripts(() => isAsked);
    expect(await hooks.load(file)).toBeNull();
    hooks.remember(await resolveConfig({ root: ROOT, configFile: false, logLevel: "silent" }, "serve"));
    expect((await hooks.load(`${file}?v=1`))?.code).not.toContain("<p");
    expect(await hooks.load(`${file}?raw`)).toBeNull();
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
        optimizeDeps: { entries: ["src/*.stories.js"], rolldownOptions: scanOptions(true) }
      },
      "serve"
    );
    const metadata = await optimizeDeps(config, true);
    expect(Object.keys(metadata.optimized)).toContain("marked");
  });
});
