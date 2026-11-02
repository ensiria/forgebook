/**
 * Tests for a story's mocked API: what starts the worker, what stops it, what never loads it, and which frame's requests
 * a story's handlers answer.
 *
 * @module
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type MockRequest,
  type MockTools,
  type MockWorker,
  startStoryMocks
} from "../src/frame/storyMocks.ts";

/** The calls a fake worker saw. */
const calls: string[] = [];

/** What the fake's `passthrough` answers. */
const PASSTHROUGH = "passthrough";

/** What decides a handler's answer. */
type Resolver = (info: { readonly request: MockRequest }) => unknown;

/** The resolver of the handler the story's handlers were given first, once a worker is set up. */
let firstResolver: Resolver | undefined;

/** A fake of MSW's browser and main modules. */
const TOOLS: MockTools = {
  http: {
    all: (path: string, resolver: Resolver): string => {
      firstResolver = resolver;
      return `all ${path}`;
    }
  },
  passthrough: (): string => PASSTHROUGH,
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

/** The fake frame's address. */
const FRAME_ADDRESS = "http://localhost:5173/frame.html?story=kit%3Aprofile--loaded&theme=dark";

/**
 * Stubs the page's worker state: `controller` is what serves it, a null when nothing does.
 *
 * @param controller - what serves the page.
 * @param href - the frame's address.
 */
const stubPage = (controller: unknown, href = FRAME_ADDRESS): void => {
  const stored = new Map<string, string>();
  vi.stubGlobal("navigator", { serviceWorker: { controller, addEventListener: (): void => undefined } });
  vi.stubGlobal("location", { href, reload: (): void => void reloads++ });
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
    expect(calls).toEqual(["setup:all *,a,b", "start:mockServiceWorker.js:bypass"]);
    stop();
    expect(calls.at(-1)).toBe("stop");
  });

  it("reads handlers as a record of lists, as MSW's Storybook addon writes them", async () => {
    calls.length = 0;
    await startStoryMocks({ msw: { handlers: { users: ["a"], posts: ["b", "c"] } } }, async () => TOOLS);
    expect(calls[0]).toBe("setup:all *,a,b,c");
  });

  describe("on a page of several frames, which one worker serves", () => {
    /** What the first handler answers a request from a page at an address: none lets the story's handlers answer. */
    const answerFor = async (referrer: string): Promise<unknown> => {
      await startStoryMocks({ msw: { handlers: ["a"] } }, async () => TOOLS);
      if (firstResolver === undefined) throw new Error("no handler came before the story's");
      return firstResolver({ request: { referrer } });
    };

    it("sends on to the network what the frame of another story asks", async () => {
      expect(await answerFor("http://localhost:5173/frame.html?story=kit%3Aprofile--empty")).toBe(
        PASSTHROUGH
      );
    });

    it("leaves its own frame's requests to its handlers, whatever the frame's view", async () => {
      expect(await answerFor(FRAME_ADDRESS)).toBeUndefined();
      expect(
        await answerFor("http://localhost:5173/frame.html?theme=light&story=kit%3Aprofile--loaded")
      ).toBeUndefined();
    });

    it("still knows another frame once its own story changed its address", async () => {
      stubPage({ state: "activated" }, "http://localhost:5173/settings");
      expect(await answerFor("http://localhost:5173/settings")).toBeUndefined();
      expect(await answerFor("http://localhost:5173/frame.html?story=kit%3Aprofile--empty")).toBe(
        PASSTHROUGH
      );
    });

    it("leaves to its handlers a request whose sender cannot be told", async () => {
      expect(await answerFor("")).toBeUndefined();
      expect(await answerFor("about:client")).toBeUndefined();
      expect(await answerFor("http://localhost:5173/assets/worker.js")).toBeUndefined();
    });
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
});
