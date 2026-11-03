/**
 * Tests for the modules the plugin makes from a file's text: a story file's code loads the colouring, and with it the
 * TypeScript compiler, only when a story has a `render` to colour.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import type { TextModuleContext } from "../src/vite/textModules.ts";

/** What the plugin gives: nothing watched, nothing resolved, nothing kept. */
const CONTEXT: TextModuleContext = {
  watch: () => undefined,
  resolveImport: async () => undefined,
  componentFiles: undefined,
  cache: undefined
};

/** Where the tests write their story files. */
const ROOT = mkdtempSync(join(tmpdir(), "forgebook-text-modules-"));

/**
 * A story file written in a folder of its own, by its text.
 *
 * @param name - the folder's name.
 * @param text - the file's text.
 */
const storyFile = (name: string, text: string): string => {
  mkdirSync(join(ROOT, name));
  const file = join(ROOT, name, "Button.stories.tsx");
  writeFileSync(file, text);
  return file;
};

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/**
 * The code module of a story file, as the page imports it, from fresh modules: the colouring's module stands in,
 * counting its loads.
 *
 * @param file - the story file.
 * @returns the module's code, and how many times the colouring loaded.
 */
const codeOf = async (file: string): Promise<{ readonly code?: string; readonly loads: number }> => {
  vi.resetModules();
  let loads = 0;
  vi.doMock(import("../src/vite/highlightCode.ts"), () => {
    loads += 1;
    return { highlightCode: (text: string): string => `<b>${text}</b>` };
  });
  const { textModule } = await import("../src/vite/textModules.ts");
  const answered = await textModule(`${file}?forgebook-code`, CONTEXT);
  return { ...(answered === undefined ? {} : { code: answered.code }), loads };
};

describe("a story file's code", () => {
  it("loads no colouring when every story is drawn from its args", async () => {
    const file = storyFile(
      "args",
      'export default { title: "Actions/Button" };\nexport const Danger = { args: { tone: "danger" } };\n'
    );
    expect(await codeOf(file)).toEqual({ code: "export default {};", loads: 0 });
  });

  it("colours a story's render", async () => {
    const file = storyFile(
      "render",
      'export default { title: "Actions/Button" };\nexport const Row = { render: () => <div /> };\n'
    );
    expect(await codeOf(file)).toEqual({
      code: 'export default {"Row":{"text":"() => <div />","html":"<b>() => <div /></b>"}};',
      loads: 1
    });
  });
});
