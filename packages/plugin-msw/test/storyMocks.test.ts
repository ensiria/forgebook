/**
 * Tests for a story's mocked API: what starts the worker, what stops it, and what it says of each request.
 *
 * @module
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlerLabel,
  handlersOf,
  type MockEvent,
  type MockTools,
  type MockWorker,
  startStoryMocks
} from "../src/storyMocks.ts";

/** The calls a fake worker saw. */
const calls: string[] = [];

/** The listeners a fake worker holds, by event. */
const listeners = new Map<string, (event: MockEvent) => void>();

/** A fake of MSW's browser module. */
const TOOLS: MockTools<string> = {
  setupWorker: (...handlers: string[]): MockWorker => {
    calls.push(`setup:${handlers.join(",")}`);
    return {
      start: async (options: Parameters<MockWorker["start"]>[0]): Promise<unknown> => {
        calls.push(`start:${options.serviceWorker.url}:${options.onUnhandledRequest}`);
        return undefined;
      },
      stop: (): void => {
        calls.push("stop");
      },
      events: {
        on: (event: string, listener: (event: MockEvent) => void): void => {
          listeners.set(event, listener);
        }
      }
    };
  }
};

/** Loads the fake. */
const load = async (): Promise<MockTools<string>> => TOOLS;

/** Ignores what the worker says. */
const quiet = (): void => undefined;

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
  calls.length = 0;
  listeners.clear();
  stubPage({ state: "activated" });
});

describe("handlersOf", () => {
  it("finds none in a story without any", () => {
    expect(handlersOf({})).toEqual([]);
    expect(handlersOf({ msw: {} })).toEqual([]);
    expect(handlersOf({ msw: { handlers: [] } })).toEqual([]);
  });

  it("reads a list, or a record of lists, as MSW's Storybook addon writes them", () => {
    expect(handlersOf({ msw: { handlers: ["a", "b"] } })).toEqual(["a", "b"]);
    expect(handlersOf({ msw: { handlers: { users: ["a"], posts: ["b", "c"] } } })).toEqual(["a", "b", "c"]);
  });
});

describe("handlerLabel", () => {
  it("reads what MSW writes in its own log", () => {
    expect(handlerLabel({ info: { header: "GET /api/users" } })).toBe("GET /api/users");
  });

  it("names a handler it cannot read", () => {
    expect(handlerLabel("a")).toBe("(unnamed handler)");
  });
});

describe("startStoryMocks", () => {
  it("starts the worker with the handlers, leaves other requests alone, and stops it", async () => {
    const stop = await startStoryMocks(["a", "b"], load, quiet);
    expect(calls).toEqual(["setup:a,b", "start:mockServiceWorker.js:bypass"]);
    await stop();
    expect(calls.at(-1)).toBe("stop");
  });

  it("says who answered each request, listening before the worker starts", async () => {
    const heard: boolean[] = [];
    await startStoryMocks(["a"], load, (_event, isMocked) => heard.push(isMocked));
    const event = { request: { method: "GET", url: "/a" }, response: { status: 200 } };
    listeners.get("response:mocked")?.(event);
    listeners.get("response:bypass")?.(event);
    expect(heard).toEqual([true, false]);
  });

  it("reloads a page the worker did not take over, and never draws its story there", async () => {
    vi.useFakeTimers();
    stubPage(null);
    let isStarted = false;
    void startStoryMocks(["a"], load, quiet).then(() => {
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
    void startStoryMocks(["a"], load, quiet);
    await vi.advanceTimersByTimeAsync(1000);
    const second = startStoryMocks(["a"], load, quiet);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await expect(second).resolves.toBeTypeOf("function");
    expect(reloads).toBe(1);
  });
});
