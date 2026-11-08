/**
 * Tests for Vite's dependency scan over a catalogue whose files do not all parse: a component that does not parse and
 * a `.js` story file holding JSX leave the other stories' packages pre-bundled.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { optimizeDeps, resolveConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";

import { scanOptions } from "../src/vite/prebundled.ts";

// inside the package, so the stories' imports resolve to its installed dependencies
const ROOT = mkdtempSync(join(import.meta.dirname, ".scan-"));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("Vite's dependency scan", () => {
  it("pre-bundles every other story's packages past a broken component and a .js story with JSX", async () => {
    mkdirSync(join(ROOT, "src"));
    const files: Readonly<Record<string, string>> = {
      "src/Good.stories.tsx":
        'import { marked } from "marked";\nexport default {};\nexport const Main = { args: { t: marked("a") } };\n',
      "src/Broken.tsx": 'import "lightningcss";\nexport const Broken = ( => 1;\n',
      "src/Broken.stories.tsx":
        'import { Broken } from "./Broken";\nexport default { component: Broken };\nexport const Main = {};\n',
      "src/Jsx.stories.js":
        'import axe from "axe-core";\nexport default {};\nexport const Main = { render: () => <p>{String(axe)}</p> };\n'
    };
    for (const [name, text] of Object.entries(files)) writeFileSync(join(ROOT, name), text);
    const warnings: string[] = [];
    const config = await resolveConfig(
      {
        root: ROOT,
        configFile: false,
        logLevel: "silent",
        cacheDir: join(ROOT, ".vite"),
        optimizeDeps: {
          entries: ["src/*.stories.@(tsx|js)"],
          rolldownOptions: scanOptions({ root: ROOT, warn: (line: string) => warnings.push(line) })
        }
      },
      "serve"
    );
    const metadata = await optimizeDeps(config, true);
    const optimized = Object.keys(metadata.optimized);
    expect(optimized).toEqual(expect.arrayContaining(["axe-core", "marked"]));
    // what the broken component imports is found too: the parser reads its imports
    expect(optimized).toContain("lightningcss");
    expect(warnings).toEqual([
      "The dependency scan skipped src/Broken.tsx:2:25 does not parse: Unexpected token"
    ]);
  });

  it("stops a quick scan on a component that does not parse, which the careful scan then reads past", async () => {
    const root = join(ROOT, "quick");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/Broken.tsx"), 'import "lightningcss";\nexport const Broken = ( => 1;\n');
    writeFileSync(
      join(root, "src/Broken.stories.tsx"),
      'import { Broken } from "./Broken";\nexport default { component: Broken };\nexport const Main = {};\n'
    );
    const scan = async (isQuick: boolean): Promise<readonly string[]> => {
      const config = await resolveConfig(
        {
          root,
          configFile: false,
          logLevel: "silent",
          cacheDir: join(root, isQuick ? ".vite-quick" : ".vite"),
          optimizeDeps: { entries: ["src/*.stories.tsx"], rolldownOptions: scanOptions({ root, isQuick }) }
        },
        "serve"
      );
      return Object.keys((await optimizeDeps(config, true)).optimized);
    };
    await expect(scan(true)).rejects.toThrow("Failed to scan for dependencies");
    expect(await scan(false)).toContain("lightningcss");
  });
});
