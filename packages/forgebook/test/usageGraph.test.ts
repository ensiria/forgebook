/**
 * Tests for what each story renders and what each module imports, on a small package where a component is rendered
 * directly, through another, under another name, inside a scene of the story file, and by nobody.
 *
 * @module
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type UsageGraph, usageGraph } from "../src/vite/usageGraph.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

/** The usage fixture package. */
const DIR = VITE_PATHS.join(import.meta.dirname, "fixtures", "usage");

/** A file of the fixture. */
const at = (name: string): string => VITE_PATHS.join(DIR, name);

/** The graph of the fixture's story files, read once. */
const graph = ((): UsageGraph => {
  const result = usageGraph([
    { storyFile: at("Badge.stories.tsx"), exports: ["Default"] },
    { storyFile: at("Tree.stories.tsx"), exports: ["Default", "Custom"] },
    { storyFile: at("Card.stories.tsx"), exports: ["Plain", "WithBadge", "InScene"] },
    { storyFile: at("Lonely.stories.tsx"), exports: ["Default"] }
  ]);
  if (typeof result === "string") throw new Error(result);
  return result;
})();

/** What each story of a story file renders, as `story: Component, Component`. */
const renders = (file: string): string[] =>
  (graph.files.find((each) => each.storyFile === at(file))?.stories ?? []).map(
    (story) => `${story.exportName}: ${story.renders.map((ref) => ref.name).join(", ")}`
  );

describe("usageGraph", () => {
  it("resolves the meta's component, written inline or as a constant", () => {
    expect(graph.files.map((file) => file.component)).toEqual([
      { file: at("Badge.tsx"), name: "Badge" },
      { file: at("Tree.tsx"), name: "Tree" },
      { file: at("Card.tsx"), name: "Card" },
      { file: at("Lonely.tsx"), name: "Lonely" }
    ]);
  });

  it("gives a story without JSX its meta's component, and a story's JSX its components, elements left out", () => {
    expect(renders("Tree.stories.tsx")).toEqual(["Default: Tree", "Custom: Tree"]);
    expect(renders("Lonely.stories.tsx")).toEqual(["Default: Lonely"]);
  });

  it("knows a component under another name, and follows a scene of the story file into its JSX", () => {
    expect(renders("Card.stories.tsx")).toEqual([
      "Plain: Card",
      "WithBadge: Card, Badge",
      "InScene: Card, Badge"
    ]);
    const badge = graph.files[2]?.stories[1]?.renders[1];
    expect(badge).toEqual({ file: at("Badge.tsx"), name: "Badge" });
  });

  it("holds the package's own imports the rendered components reach, never a dependency's", () => {
    expect(graph.imports[at("Tree.tsx")]).toEqual([at("Row.tsx")]);
    expect(graph.imports[at("Row.tsx")]).toEqual([at("Badge.tsx")]);
    // react is a dependency: Badge imports nothing of the package
    expect(graph.imports[at("Badge.tsx")]).toEqual([]);
  });
});

describe("usageGraph on a monorepo", () => {
  it("reads each configuration's story files with a program of their own, and joins them", () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), "forgebook-usage-monorepo-")));
    const write = (file: string, text: string): void => {
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), text);
    };
    const options = { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true };
    for (const name of ["a", "b"]) {
      write(`${name}/tsconfig.json`, JSON.stringify({ compilerOptions: options, include: ["*.tsx"] }));
      write(`${name}/Box.tsx`, "export const Box = () => null;\n");
      write(
        `${name}/Box.stories.tsx`,
        'import { Box } from "./Box";\nexport default { title: "Box", component: Box };\nexport const Plain = {};\n'
      );
    }
    const found = usageGraph(
      ["a", "b"].map((name) => ({
        storyFile: VITE_PATHS.join(root, name, "Box.stories.tsx"),
        exports: ["Plain"]
      }))
    );
    if (typeof found === "string") throw new Error(found);
    expect(found.files.map((file) => file.component?.file)).toEqual([
      VITE_PATHS.join(root, "a", "Box.tsx"),
      VITE_PATHS.join(root, "b", "Box.tsx")
    ]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("usageGraph on what a story renders", () => {
  it("finds a compound component's parts and an installed library's components", () => {
    // inside the package, so the framework's types are found: a compound component is typed through them
    const root = realpathSync.native(mkdtempSync(join(import.meta.dirname, ".usage-renders-")));
    const write = (file: string, text: string): void => {
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), text);
    };
    const options = { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true };
    write("tsconfig.json", JSON.stringify({ compilerOptions: options, include: ["*.tsx"] }));
    write("MenuItem.tsx", "export const MenuItem = () => null;\n");
    write(
      "Menu.tsx",
      [
        'import { forwardRef, type ReactNode } from "react";',
        'import { MenuItem } from "./MenuItem";',
        "const MenuRoot = forwardRef<HTMLDivElement, { children?: ReactNode }>((props, ref) => (",
        "  <div ref={ref}>{props.children}</div>",
        "));",
        "export const Menu = Object.assign(MenuRoot, { Item: MenuItem });",
        ""
      ].join("\n")
    );
    write("node_modules/ext/package.json", JSON.stringify({ name: "ext", types: "index.d.ts" }));
    write("node_modules/ext/index.d.ts", "export declare const ExtButton: () => null;\n");
    write(
      "Menu.stories.tsx",
      [
        'import { ExtButton } from "ext";',
        'import { Menu } from "./Menu";',
        'export default { title: "Menu", component: Menu };',
        "export const Plain = { render: () => <Menu><Menu.Item /><ExtButton /></Menu> };",
        ""
      ].join("\n")
    );
    try {
      const found = usageGraph([
        { storyFile: VITE_PATHS.join(root, "Menu.stories.tsx"), exports: ["Plain"] }
      ]);
      if (typeof found === "string") throw new Error(found);
      const renders = found.files.flatMap((file) => file.stories.flatMap((story) => story.renders));
      // the part is the property the compound component is assigned
      expect(renders).toContainEqual({ file: VITE_PATHS.join(root, "Menu.tsx"), name: "Item" });
      expect(renders).toContainEqual({
        file: VITE_PATHS.join(root, "node_modules", "ext", "index.d.ts"),
        name: "ExtButton"
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
