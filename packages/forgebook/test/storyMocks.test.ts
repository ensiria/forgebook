/**
 * Tests for a story's mocked API: what starts the worker, what stops it, and what never loads it.
 *
 * @module
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type MockTools, type MockWorker, startStoryMocks } from "../src/frame/storyMocks.ts";

/** The calls a fake worker saw. */
const calls: string[] = [];

/** A fake of MSW's browser module. */
const TOOLS: MockTools = {
  setupWorker: (...handlers: readonly unknown[]): MockWorker => {
    calls.push(`setup:${handlers.join(",")}`);
    return {
      start: async (options: Parameters<MockWorker["start"]>[0]): Promise<unknown> => {
        calls.push(`start:${options.serviceWorker.url}:${options.onUnhandledRequest}`);
        return undefined;
      },
      stop: (): void => {
        calls.push("stop");
      }
    };
  }
};

/** What a fake page's reloads were. */
let reloads = 0;

/** Stubs the page's worker state: `controller` is what serves it, a null when nothing does. */
const stubPage = (controller: unknown): void => {
  const stored = new Map<string, string>();
  vi.stubGlobal("navigator", { serviceWorker: { controller, addEventListener: (): void => undefined } });
  vi.stubGlobal("location", { reload: (): void => void reloads++ });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string): string | null => stored.get(key) ?? null,
    setItem: (key: string, value: string): void => void stored.set(key, value),
    removeItem: (key: string): void => void stored.delete(key)
  });
};

beforeEach(() => {
  reloads = 0;
  stubPage({ state: "activated" });
});

describe("startStoryMocks", () => {
  it("never loads MSW for a story with no handlers", async () => {
    let wasLoaded = false;
    const load = async (): Promise<MockTools> => {
      wasLoaded = true;
      return TOOLS;
    };
    await startStoryMocks({}, load);
    await startStoryMocks({ msw: {} }, load);
    await startStoryMocks({ msw: { handlers: [] } }, load);
    expect(wasLoaded).toBe(false);
  });

  it("starts a worker with the story's handlers, and stops it when the story is undone", async () => {
    calls.length = 0;
    const stop = await startStoryMocks({ msw: { handlers: ["a", "b"] } }, async () => TOOLS);
    expect(calls).toEqual(["setup:a,b", "start:mockServiceWorker.js:bypass"]);
    stop();
    expect(calls.at(-1)).toBe("stop");
  });

  it("reads handlers as a record of lists, as MSW's Storybook addon writes them", async () => {
    calls.length = 0;
    await startStoryMocks({ msw: { handlers: { users: ["a"], posts: ["b", "c"] } } }, async () => TOOLS);
    expect(calls[0]).toBe("setup:a,b,c");
  });

  it("says what to do when a story has handlers and the project has no MSW", async () => {
    await expect(startStoryMocks({ msw: { handlers: ["a"] } }, undefined)).rejects.toThrow(
      "npm install --save-dev msw"
    );
  });

  it("reloads a page the worker did not take over, and never draws its story there", async () => {
    vi.useFakeTimers();
    stubPage(null);
    let isStarted = false;
    void startStoryMocks({ msw: { handlers: ["a"] } }, async () => TOOLS).then(() => {
      isStarted = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    expect(reloads).toBe(1);
    expect(isStarted).toBe(false);
  });

  it("reloads once at most, so a page no worker can serve still draws its story", async () => {
    vi.useFakeTimers();
    stubPage(null);
    void startStoryMocks({ msw: { handlers: ["a"] } }, async () => TOOLS);
    await vi.advanceTimersByTimeAsync(1000);
    const second = startStoryMocks({ msw: { handlers: ["a"] } }, async () => TOOLS);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await expect(second).resolves.toBeTypeOf("function");
    expect(reloads).toBe(1);
  });

  it("draws its story where the browser denies the storage, never reloading blind", async () => {
    vi.useFakeTimers();
    stubPage(null);
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get: (): never => {
        throw new Error("denied");
      }
    });
    const started = startStoryMocks({ msw: { handlers: ["a"] } }, async () => TOOLS);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await expect(started).resolves.toBeTypeOf("function");
    expect(reloads).toBe(0);
  });
});
