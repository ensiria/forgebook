/**
 * Tests for how the catalogue's Vite plugin takes a story file's edit on a dev server: the file accepts it, a pattern's
 * module takes what its files hand on, and an edit that changes a pattern's list reloads the pages.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  readonly hotUpdate: (file: string) => unknown;
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
    hotUpdate: (file: string): unknown => hotUpdate.call(context as never, { file } as never)
  };
};

describe("a story file's edit on a dev server", () => {
  it("is accepted by the file, which imports itself to hand the frame its stories before and after", () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }), fakeEnvironment().environment);
    const code = codeOf(hooks.transform(ONE_STORY, "/kit/src/Badge.stories.tsx"));
    expect(code.startsWith(ONE_STORY)).toBe(true);
    expect(code).toContain('import * as __forgebookShown from "/kit/src/Badge.stories.tsx";');
    expect(code).toContain("import.meta.hot.accept(");
    expect(code).toContain("import.meta.hot.invalidate()");
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
});
