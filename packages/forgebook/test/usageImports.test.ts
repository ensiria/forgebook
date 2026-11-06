/**
 * Tests for the edges read from text: what a style sheet imports, the assets a module names, and a real program's
 * imports, by the file that declares each name.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { storyReach } from "../src/vite/storyReach.ts";
import { assetImports, sheetImports } from "../src/vite/textImports.ts";
import { usageGraph } from "../src/vite/usageGraph.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

describe("sheetImports", () => {
  it("finds a partial Sass wrote without its underscore or extension", () => {
    const exists = (path: string): boolean => path === "/p/src/_vars.scss";
    expect(sheetImports("/p/src/a.scss", '@use "vars";\n', exists)).toEqual(["/p/src/_vars.scss"]);
  });

  it("follows a CSS import, and leaves out an address and a built-in module", () => {
    const text = '@import "./b.css";\n@import url("https://x.example/f.css");\n@use "sass:math";\n';
    expect(sheetImports("/p/a.css", text, (path) => path === "/p/b.css")).toEqual(["/p/b.css"]);
  });

  it("reads every name an import lists, and Less's options", () => {
    const text = '@import "./x.scss", "./y.scss";\n@import (reference) "./z.less";\n';
    expect(sheetImports("/p/a.scss", text, () => false)).toEqual(["/p/x.scss", "/p/y.scss", "/p/z.less"]);
  });

  it("keeps where a missing one points: it may have just been deleted", () => {
    expect(sheetImports("/p/a.css", '@import "./gone.css";', () => false)).toEqual(["/p/gone.css"]);
  });
});

describe("assetImports", () => {
  it("finds a sheet, a template and a single-file component wherever a module names them", () => {
    const text = [
      'import "./a.css";',
      'import styles from "./b.module.scss?inline";',
      'const Lazy = () => import("../Panel.vue");',
      '@Component({ templateUrl: "./x.component.html", styleUrls: ["./x.component.scss"] })',
      'const notAPath = "a.css";'
    ].join("\n");
    expect(assetImports("/p/src/M.ts", text)).toEqual([
      "/p/src/a.css",
      "/p/src/b.module.scss",
      "/p/Panel.vue",
      "/p/src/x.component.html",
      "/p/src/x.component.scss"
    ]);
  });
});

describe("the graph of a small package", () => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "forgebook-usage-imports-")));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const write = (file: string, text: string): void => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true },
      include: ["*.ts", "*.tsx"]
    })
  );
  write(
    "index.ts",
    'import "./global.css";\nexport { Card } from "./Card";\nexport { Unused } from "./Unused";\n'
  );
  write("global.css", "body { margin: 0; }\n");
  write("Unused.tsx", "export const Unused = () => null;\n");
  write("_vars.scss", "$ink: black;\n");
  write("card.scss", '@use "vars";\n');
  write("Panel.tsx", "export const Panel = () => null;\n");
  write(
    "Card.tsx",
    [
      'import "./card.scss";',
      'import { lazy } from "react";',
      'import { Gone } from "./Gone";',
      'const Lazy = lazy(() => import("./Panel"));',
      "export const Card = () => <Lazy><Gone /></Lazy>;",
      ""
    ].join("\n")
  );
  write(
    "Card.stories.tsx",
    'import { Card } from "./index";\nexport default { title: "Card", component: Card };\nexport const Plain = {};\n'
  );

  const at = (file: string): string => VITE_PATHS.join(root, file);
  const graph = usageGraph([{ storyFile: at("Card.stories.tsx"), exports: ["Plain"] }]);
  if (typeof graph === "string") throw new Error(graph);
  const [story] = storyReach(graph, [{ storyFile: at("Card.stories.tsx"), title: "Card" }]);

  it("reaches a name through a barrel without the barrel's other exports", () => {
    expect(story?.files).toContain(at("Card.tsx"));
    expect(story?.files).not.toContain(at("Unused.tsx"));
  });

  it("runs what a barrel imports for its side effects, whichever name is taken through it", () => {
    expect(story?.files).toContain(at("global.css"));
  });

  it("reaches a sheet and the partial it uses, a lazy module, and where a missing import points", () => {
    expect(story?.files).toEqual(
      expect.arrayContaining([at("card.scss"), at("_vars.scss"), at("Panel.tsx"), at("Gone")])
    );
  });

  it("tells what a story draws from what it reaches through it", () => {
    expect(story?.own).toEqual(expect.arrayContaining([at("Card.stories.tsx"), at("Card.tsx")]));
    expect(story?.own).not.toContain(at("Panel.tsx"));
  });
});

describe("a graph with names no file declares", () => {
  const root = realpathSync.native(mkdtempSync(join(import.meta.dirname, ".usage-ambient-")));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const write = (file: string, text: string): void => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
        paths: { "@/*": ["./*"] }
      },
      include: ["*.ts", "*.tsx"]
    })
  );
  write("shims.d.ts", 'declare module "*.vue" { const c: unknown; export default c; }\n');
  write("node_modules/ext/package.json", JSON.stringify({ name: "ext", types: "index.d.ts" }));
  write("node_modules/ext/index.d.ts", "export declare const Ext: () => null;\n");
  write(
    "barrel.ts",
    [
      'export { default as Shown } from "./Shown.vue";',
      'export { default as Unseen } from "./Unseen.vue";',
      'export { Ext } from "ext";',
      'export { Other } from "./Other";',
      ""
    ].join("\n")
  );
  write("Other.tsx", "export const Other = () => null;\n");
  write("Shown.vue", '<script setup>\nimport "@/shown.css";\n</script>\n');
  write("Unseen.vue", "<template />\n");
  write("shown.css", "");
  write("aliased.css", "");
  write(
    "A.stories.tsx",
    [
      'import "@/aliased.css";',
      'import { Ext, Shown } from "./barrel";',
      'export default { title: "A", component: Shown };',
      "export const Plain = { render: () => <Ext /> };",
      ""
    ].join("\n")
  );
  const at = (file: string): string => VITE_PATHS.join(root, file);
  const graph = usageGraph([{ storyFile: at("A.stories.tsx"), exports: ["Plain"] }]);
  if (typeof graph === "string") throw new Error(graph);
  const [story] = storyReach(graph, [{ storyFile: at("A.stories.tsx"), title: "A" }]);

  it("follows a single-file component through a barrel by its own name, not the barrel's others", () => {
    expect(story?.files).toContain(at("Shown.vue"));
    expect(story?.files).not.toContain(at("Unseen.vue"));
    expect(story?.files).not.toContain(at("Other.tsx"));
  });

  it("follows a path alias to a sheet, from a module and from a single-file component", () => {
    expect(story?.files).toEqual(expect.arrayContaining([at("aliased.css"), at("shown.css")]));
  });
});
