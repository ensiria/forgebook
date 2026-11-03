/**
 * Tests for the files a story file's docs can change with: what it reaches, type imports and `import()` types
 * included, files TypeScript does not read, the configurations and the lock file.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { docsDependencies } from "../src/vite/docsDependencies.ts";

// as the file system names it: the module resolution answers real paths (a temporary folder is behind a link on macOS)
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), "forgebook-docs-dependencies-")));

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/** Writes files under the root. */
const write = (files: Readonly<Record<string, string>>): void => {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(ROOT, name, ".."), { recursive: true });
    writeFileSync(join(ROOT, name), text);
  }
};

/** The dependencies' names, relative to the root, with forward slashes. */
const named = (paths: readonly string[]): string[] =>
  paths.map((path) => path.replaceAll("\\", "/").replace(`${ROOT.replaceAll("\\", "/")}/`, "")).sort();

describe("docsDependencies", () => {
  it("names what the story file reaches, the configurations and the lock file, not what is installed", () => {
    write({
      "package-lock.json": "{}",
      "tsconfig.base.json": JSON.stringify({ compilerOptions: { strict: true } }),
      "tsconfig.json": JSON.stringify({
        extends: "./tsconfig.base.json",
        compilerOptions: { module: "esnext", moduleResolution: "bundler", jsx: "react-jsx" },
        include: ["src"]
      }),
      "src/global.d.ts": "declare const flag: boolean;\n",
      "src/Button.stories.tsx":
        'import { Button } from "./Button";\nimport "./Badge.svelte";\nimport { dep } from "dep";\nexport default { component: Button, args: { dep } };\n',
      "src/Button.tsx":
        'import type { Props } from "./props";\nexport const Button = (props: Props) => null;\n',
      "src/props.ts": 'export type Props = { tone: import("./tones").Tone };\n',
      "src/tones.ts": 'export type Tone = "a" | "b";\n',
      "src/Badge.svelte": "<span />\n",
      "node_modules/dep/index.d.ts": "export declare const dep: number;\n",
      "node_modules/dep/package.json": JSON.stringify({ name: "dep", types: "index.d.ts" })
    });
    expect(named(docsDependencies([join(ROOT, "src", "Button.stories.tsx")]))).toEqual([
      "node_modules/dep/package.json",
      "package-lock.json",
      "src",
      "src/Badge.svelte",
      "src/Button.stories.tsx",
      "src/Button.tsx",
      "src/global.d.ts",
      "src/props.ts",
      "src/tones.ts",
      "tsconfig.base.json",
      "tsconfig.json"
    ]);
  });

  it("follows a workspace package linked into node_modules, an alias to a component file, and its own imports", () => {
    write({
      "ws/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          baseUrl: ".",
          paths: { "@/*": ["src/*"] }
        },
        include: ["src"]
      }),
      "ws/src/Card.stories.ts":
        'import { tone } from "ui";\nimport Card from "@/Card.vue";\nexport default { component: Card, args: { tone } };\n',
      "ws/src/Card.vue":
        '<script setup lang="ts">\nimport type { Size } from "./size";\ndefineProps<{ size: Size }>();\n</script>\n',
      "ws/src/size.ts": 'export type Size = "s" | "m";\n',
      "ui/package.json": JSON.stringify({ name: "ui", types: "src/index.ts" }),
      "ui/src/index.ts": 'export const tone = "a";\n'
    });
    mkdirSync(join(ROOT, "ws", "node_modules"), { recursive: true });
    symlinkSync(join(ROOT, "ui"), join(ROOT, "ws", "node_modules", "ui"), "dir");
    const paths = named(docsDependencies([join(ROOT, "ws", "src", "Card.stories.ts")]));
    expect(paths).toContain("ws/src/Card.vue");
    expect(paths).toContain("ws/src/size.ts");
    expect(paths).toContain("ui/src/index.ts");
  });
});
