/**
 * Tests for the Accessibility check's loading of axe: one script for checks asked together, a build's gzipped copy
 * unpacked into a blob, and a frame mounted without axe's address told so.
 *
 * @module
 */
// @vitest-environment happy-dom
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { A11ySettings } from "../src/catalogue.ts";
import { DEFAULT_A11Y_TAGS } from "../src/catalogue.ts";
import { checkStory } from "../src/frame/checkStory.ts";

/** The rules every check here runs. */
const DEFAULT_A11Y: A11ySettings = { tags: DEFAULT_A11Y_TAGS, disabledRules: [] };

/** An axe that finds nothing, as the script sets it on the window. */
const FAKE_AXE = { run: async (): Promise<{ violations: [] }> => ({ violations: [] }) };

/**
 * Makes every script the frame adds run at once: it sets axe on the window and loads.
 *
 * @returns the addresses of the scripts added.
 */
const runScripts = (): string[] => {
  const added: string[] = [];
  vi.spyOn(document.head, "append").mockImplementation((...nodes: (Node | string)[]): void => {
    for (const node of nodes) {
      if (!(node instanceof HTMLScriptElement)) continue;
      added.push(node.src);
      queueMicrotask(() => {
        Reflect.set(window, "axe", FAKE_AXE);
        node.dispatchEvent(new Event("load"));
      });
    }
  });
  return added;
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "axe");
});

describe("checkStory", () => {
  it("adds axe's script once for two checks asked together", async () => {
    const added = runScripts();
    const [first, second] = await Promise.all([
      checkStory(document, DEFAULT_A11Y, "/axe.min.js"),
      checkStory(document, DEFAULT_A11Y, "/axe.min.js")
    ]);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(added).toHaveLength(1);
  });

  it("unpacks a build's gzipped copy and runs it from a blob", async () => {
    const added = runScripts();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(gzipSync("window.axe = {};")));
    await checkStory(document, DEFAULT_A11Y, "/assets/axe-12345678.bin?v=1");
    expect(added).toHaveLength(1);
    expect(added[0]).toMatch(/^blob:/);
  });

  it("says why a frame mounted without axe's address cannot be checked", async () => {
    await expect(checkStory(document, DEFAULT_A11Y, undefined)).rejects.toThrow(/axeUrl/);
  });
});
