/**
 * Tests for the plugin's frame module: a story's mocks start with its first mount and stay until the page is left.
 *
 * @module
 */
import type { PluginPrepareContext } from "forgebook/plugin";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { frame } from "../src/frame.ts";

/** What the fake MSW saw, in order. */
const calls: string[] = [];

vi.mock("msw/browser", () => ({
  setupWorker: () => ({
    start: async (): Promise<undefined> => {
      calls.push("start");
      return undefined;
    },
    stop: (): void => {
      calls.push("stop");
    },
    events: { on: (): undefined => undefined }
  })
}));

vi.mock("msw", () => ({
  http: { all: (path: string): string => `all ${path}` },
  passthrough: (): string => "passthrough"
}));

/** The page's `pagehide` listeners. */
let pageHides: ((event: { readonly persisted: boolean }) => void)[] = [];

/**
 * A story's context, with the parameters given.
 *
 * @param parameters - the story's parameters.
 */
const contextOf = (parameters: Readonly<Record<string, unknown>>): PluginPrepareContext => ({
  args: {},
  text: (key: string): string => key,
  clock: {
    now: (): number => 0,
    subscribe: () => (): undefined => undefined,
    advance: (): undefined => undefined
  },
  globals: {},
  loaded: {},
  id: "kit:a--b",
  name: "B",
  title: "A",
  parameters
});

/** Lets the started worker's promises settle. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  calls.length = 0;
  pageHides = [];
  vi.stubGlobal("window", {
    location: { origin: "http://localhost:5173" },
    addEventListener: (type: string, listener: (event: { readonly persisted: boolean }) => void): void => {
      if (type === "pagehide") pageHides.push(listener);
    }
  });
  vi.stubGlobal("location", {
    href: "http://localhost:5173/frame.html?story=a",
    reload: (): undefined => undefined
  });
  vi.stubGlobal("navigator", {
    serviceWorker: { controller: {}, addEventListener: (): undefined => undefined }
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (): null => null,
    setItem: (): undefined => undefined,
    removeItem: (): undefined => undefined
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the frame module", () => {
  it("starts a story's mocks once, however many times it is mounted, and stops them as the page goes", async () => {
    const plugin = frame({ report: (): undefined => undefined });
    const context = contextOf({ msw: { handlers: [{ info: { header: "GET /a" } }] } });
    await plugin.prepare?.(context);
    await plugin.prepare?.(context);
    expect(calls).toEqual(["start"]);
    for (const hide of pageHides) hide({ persisted: true });
    await settled();
    expect(calls).toEqual(["start"]);
    for (const hide of pageHides) hide({ persisted: false });
    await settled();
    expect(calls).toEqual(["start", "stop"]);
  });

  it("loads nothing for a story without handlers", async () => {
    const plugin = frame({ report: (): undefined => undefined });
    await plugin.prepare?.(contextOf({}));
    expect(calls).toEqual([]);
  });
});
