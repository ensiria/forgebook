/**
 * Tests for how the catalogue's Vite plugin takes a story file's edit on a dev server: the file accepts it, a pattern's
 * module takes what its files hand on, and an edit that changes a pattern's list reloads the pages.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { transformWithOxc } from "vite";
import { describe, expect, it } from "vitest";

import { forgebookPlugin } from "../src/vite/forgebookPlugin.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A story file with one story. */
const ONE_STORY =
  'export default { title: "Kit/Badge" };\nexport const Badge = { args: { label: "New" } };\n';

/** A catalogue's folder with one story file, and the module that declares its pattern. */
const catalogue = (): { readonly file: string; readonly declaring: string } => {
  const dir = mkdtempSync(join(tmpdir(), "forgebook-hot-"));
  mkdirSync(join(dir, "src"));
  const file = join(dir, "src", "Badge.stories.tsx");
  writeFileSync(file, ONE_STORY);
  return { file, declaring: join(dir, "stories.ts") };
};

/** The code a load or a transform answered. */
const codeOf = (answer: unknown): string =>
  typeof answer === "object" && answer !== null && "code" in answer ? String(answer.code) : "";

/** A dev server's client environment reduced to what the plugin touches, recording what it does. */
const fakeEnvironment = (): {
  readonly environment: unknown;
  readonly invalidated: string[];
  readonly sent: unknown[];
} => {
  const invalidated: string[] = [];
  const sent: unknown[] = [];
  const environment = {
    name: "client",
    moduleGraph: {
      getModuleById: (id: string): { id: string } => ({ id }),
      invalidateModule: (module: { id: string }): void => void invalidated.push(module.id)
    },
    hot: { send: (payload: unknown): void => void sent.push(payload) }
  };
  return { environment, invalidated, sent };
};

/** The plugin's hooks this file calls, as Vite calls them on a dev server. */
const hooksOf = (
  plugin: ReturnType<typeof forgebookPlugin>,
  environment: unknown
): {
  readonly resolveId: (source: string, importer: string) => unknown;
  readonly load: (id: string) => unknown;
  readonly transform: (code: string, id: string) => unknown;
  readonly hotUpdate: (file: string, type?: "create" | "update" | "delete") => unknown;
} => {
  const { resolveId, load, transform, hotUpdate } = plugin;
  if (
    typeof resolveId !== "function" ||
    typeof load !== "function" ||
    typeof transform !== "object" ||
    typeof hotUpdate !== "function"
  )
    throw new Error("missing hooks");
  const context = { addWatchFile: (): undefined => undefined, environment };
  return {
    resolveId: (source: string, importer: string): unknown =>
      resolveId.call(context as never, source, importer, { isEntry: false } as never),
    load: (id: string): unknown => load.call(context as never, id),
    transform: (code: string, id: string): unknown => transform.handler.call(context as never, code, id),
    hotUpdate: (file: string, type: "create" | "update" | "delete" = "update"): unknown =>
      hotUpdate.call(context as never, { file, type } as never)
  };
};

describe("a story file's edit on a dev server", () => {
  it("is accepted by the file, which imports itself to hand the frame its stories before and after", () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const code = codeOf(hooks.transform(ONE_STORY, "/kit/src/Badge.stories.tsx"));
    // first, so a file that throws while it loads still accepts its fix; on its first line, so no line moves
    expect(code.startsWith('import * as __forgebookShown from "/kit/src/Badge.stories.tsx";')).toBe(true);
    expect(code.endsWith(ONE_STORY)).toBe(true);
    expect(code.split("\n")).toHaveLength(ONE_STORY.split("\n").length);
    expect(code).toContain("import.meta.hot.accept(");
    expect(code).toContain("import.meta.hot.invalidate()");
  });

  it("keeps a file's directives first", () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const code = codeOf(hooks.transform(`"use client";\n${ONE_STORY}`, "/kit/src/Badge.stories.tsx"));
    expect(code.startsWith('"use client"; import * as __forgebookShown')).toBe(true);
  });

  it("keeps a file's leading comments first, where a compiler reads its JSX pragmas", async () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const pragmas = "/** @jsxRuntime automatic */\n/** @jsxImportSource @kit/jsx */\n";
    const story = `${pragmas}export default { title: "Kit/Badge" };\nexport const Badge = () => <b />;\n`;
    const code = codeOf(hooks.transform(story, "/kit/src/Badge.stories.tsx"));
    expect(code.startsWith(`${pragmas.trimEnd()} import * as __forgebookShown`)).toBe(true);
    expect(code.split("\n")).toHaveLength(story.split("\n").length);
    // the compiler after the plugin still reads them: a pragma after a statement is ignored
    const { code: compiled } = await transformWithOxc(code, "/kit/src/Badge.stories.tsx", {
      jsx: { runtime: "automatic", importSource: "react" }
    });
    expect(compiled).toContain('from "@kit/jsx/jsx-runtime"');
  });

  it("keeps line comments and directives in any order before it", () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const head = '// @jsxImportSource @kit/jsx\n"use client";\n/* note */';
    const code = codeOf(hooks.transform(`${head}${ONE_STORY}`, "/kit/src/Badge.stories.tsx"));
    expect(code.startsWith(`${head} import * as __forgebookShown`)).toBe(true);
  });

  it("does not take a comment inside the code for a leading one", () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const story = `const text = "/* not a comment */";\n${ONE_STORY}`;
    const code = codeOf(hooks.transform(story, "/kit/src/Badge.stories.tsx"));
    expect(code.startsWith("import * as __forgebookShown")).toBe(true);
  });

  it("is taken by a pattern's module, so a file no frame draws reloads nothing", async () => {
    const { declaring } = catalogue();
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const id = String(hooks.resolveId("./src/*.stories.tsx?forgebook-files", declaring));
    expect(codeOf(await hooks.load(id))).toContain("if (import.meta.hot) import.meta.hot.accept();");
  });

  it("reloads the pages when it changes a pattern's list, and leaves one that does not to the modules", async () => {
    const { file, declaring } = catalogue();
    const fake = fakeEnvironment();
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fake.environment);
    const id = String(hooks.resolveId("./src/*.stories.tsx?forgebook-files", declaring));
    await hooks.load(id);
    writeFileSync(file, ONE_STORY.replace('"New"', '"Edited"'));
    expect(hooks.hotUpdate(file)).toBeUndefined();
    expect(fake.sent).toEqual([]);
    writeFileSync(file, `${ONE_STORY}export const Added = { args: { label: "Added" } };\n`);
    expect(hooks.hotUpdate(file)).toEqual([]);
    expect(fake.invalidated).toEqual([id]);
    expect(fake.sent).toEqual([{ type: "full-reload" }]);
  });

  it("is left to a reload for a framework whose compiler leaves out what the plugin adds", async () => {
    const { declaring } = catalogue();
    const framework = { ...STUB_FRAMEWORK, redrawsEditedStories: false };
    const hooks = hooksOf(forgebookPlugin({ framework }), fakeEnvironment().environment);
    expect(hooks.transform(ONE_STORY, "/kit/src/Badge.stories.tsx")).toBeUndefined();
    const id = String(hooks.resolveId("./src/*.stories.tsx?forgebook-files", declaring));
    expect(codeOf(await hooks.load(id))).not.toContain("import.meta.hot");
  });

  it("leaves a story file removed to the lists' own reload, without reading it", async () => {
    const { file, declaring } = catalogue();
    const fake = fakeEnvironment();
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fake.environment);
    await hooks.load(String(hooks.resolveId("./src/*.stories.tsx?forgebook-files", declaring)));
    rmSync(file);
    expect(hooks.hotUpdate(file, "delete")).toBeUndefined();
    expect(hooks.hotUpdate(file, "update")).toBeUndefined();
    expect(fake.sent).toEqual([]);
  });
});
