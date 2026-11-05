/**
 * Tests for a story's mocked API: what starts the worker, what stops it, what it says of each request, and which
 * frame's requests a story's handlers answer.
 *
 * @module
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlerLabel,
  type MockEvent,
  type MockRequest,
  type MockTools,
  type MockWorker,
  startStoryMocks
} from "../src/storyMocks.ts";

/** The calls a fake worker saw. */
const calls: string[] = [];

/** The listeners a fake worker holds, by event. */
const listeners = new Map<string, (event: MockEvent) => void>();

/** What the fake's `passthrough` answers. */
const PASSTHROUGH = "passthrough";

/** What decides a handler's answer. */
type Resolver = (info: { readonly request: MockRequest }) => string | undefined;

/** The resolver of the handler the story's handlers were given first, once a worker is set up. */
let firstResolver: Resolver | undefined;

/** A fake of MSW's browser and main modules. */
const TOOLS: MockTools<string, string> = {
  http: {
    all: (path: string, resolver: Resolver): string => {
      firstResolver = resolver;
      return `all ${path}`;
    }
  },
  passthrough: (): string => PASSTHROUGH,
  setupWorker: (...handlers: string[]): MockWorker<string> => {
    calls.push(`setup:${handlers.join(",")}`);
    return {
      start: async (options: Parameters<MockWorker<string>["start"]>[0]): Promise<unknown> => {
        calls.push(`start:${options.serviceWorker.url}:${options.onUnhandledRequest}`);
        return undefined;
      },
      stop: (): void => {
        calls.push("stop");
      },
      resetHandlers: (...next: string[]): void => {
        calls.push(`reset:${next.join(",")}`);
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
const load = async (): Promise<MockTools<string, string>> => TOOLS;

/** Ignores what the worker says. */
const quiet = (): void => undefined;

/** What a fake page's reloads were. */
let reloads = 0;

/** The fake frame's address. */
const FRAME_ADDRESS = "http://localhost:5173/frame.html?story=kit%3Aprofile--loaded&theme=dark";

/** How a fake page came to be: as the browser's navigation entry says. */
type NavigationType = "navigate" | "reload";

/** What a fake page holds in its session storage, which every frame of a page shares. */
let stored = new Map<string, string>();

/**
 * Stubs the page's worker state: `controller` is what serves it, a null when nothing does.
 *
 * @param controller - what serves the page.
 * @param href - the frame's address.
 * @param navigation - how the page came to be.
 */
const stubPage = (
  controller: unknown,
  href = FRAME_ADDRESS,
  navigation: NavigationType = "navigate"
): void => {
  vi.stubGlobal("navigator", { serviceWorker: { controller, addEventListener: (): void => undefined } });
  vi.stubGlobal("location", { href, reload: (): void => void reloads++ });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string): string | null => stored.get(key) ?? null,
    setItem: (key: string, value: string): void => void stored.set(key, value),
    removeItem: (key: string): void => void stored.delete(key)
  });
  const entry = {
    name: href,
    entryType: "navigation",
    startTime: 0,
    duration: 0,
    toJSON: (): object => ({}),
    type: navigation
  };
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([entry]);
};

/** Starts a story with handlers, letting the page's wait for a worker run out. */
const startUnserved = async (): Promise<void> => {
  void startStoryMocks(["a"], load, quiet);
  await vi.advanceTimersByTimeAsync(1000);
};

beforeEach(() => {
  reloads = 0;
  stored = new Map();
  calls.length = 0;
  listeners.clear();
  stubPage({ state: "activated" });
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
    const mocks = await startStoryMocks(["a", "b"], load, quiet);
    expect(calls).toEqual(["setup:all *,a,b", "start:mockServiceWorker.js:bypass"]);
    await mocks.stop();
    expect(calls.at(-1)).toBe("stop");
  });

  it("renews the handlers in the running worker, keeping each frame to its own", async () => {
    const mocks = await startStoryMocks(["a"], load, quiet);
    mocks.renew(["b", "c"]);
    expect(calls.slice(-1)).toEqual(["reset:all *,b,c"]);
    expect(calls).not.toContain("stop");
  });

  it("tells nothing of the requests it relays for another frame", async () => {
    const heard: string[] = [];
    await startStoryMocks(["a"], load, (event) => heard.push(event.request.url));
    const response = { status: 200 };
    listeners.get("response:bypass")?.({
      request: {
        method: "GET",
        url: "/other",
        referrer: "http://localhost:5173/frame.html?story=kit%3Aprofile--empty"
      },
      response
    });
    listeners.get("response:bypass")?.({
      request: { method: "GET", url: "/own", referrer: FRAME_ADDRESS },
      response
    });
    expect(heard).toEqual(["/own"]);
  });

  it("says who answered each request, listening before the worker starts", async () => {
    const heard: boolean[] = [];
    await startStoryMocks(["a"], load, (_event, isMocked) => heard.push(isMocked));
    const event = {
      request: { method: "GET", url: "/a", referrer: FRAME_ADDRESS },
      response: { status: 200 }
    };
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
    await startUnserved();
    stubPage(null, FRAME_ADDRESS, "reload");
    const second = startStoryMocks(["a"], load, quiet);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await expect(second).resolves.toHaveProperty("stop");
    expect(reloads).toBe(1);
  });

  it("reloads every frame of a page the worker did not take over, not the first one alone", async () => {
    vi.useFakeTimers();
    stubPage(null);
    await startUnserved();
    stubPage(null, "http://localhost:5173/frame.html?story=kit%3Aprofile--empty");
    await startUnserved();
    vi.useRealTimers();
    expect(reloads).toBe(2);
  });

  it("reloads again a frame shown anew, whatever mark an earlier visit left", async () => {
    vi.useFakeTimers();
    stubPage(null);
    await startUnserved();
    stubPage(null);
    await startUnserved();
    vi.useRealTimers();
    expect(reloads).toBe(2);
  });

  it("reloads a frame that a reload of its own brought, when the worker was not the reason", async () => {
    vi.useFakeTimers();
    stubPage(null, FRAME_ADDRESS, "reload");
    await startUnserved();
    vi.useRealTimers();
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
    const started = startStoryMocks(["a"], load, quiet);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await expect(started).resolves.toHaveProperty("stop");
    expect(reloads).toBe(0);
  });
});

describe("on a page of several frames, which one worker serves", () => {
  /** What the first handler answers a request from a page at an address: none lets the story's handlers answer. */
  const answerFor = async (referrer: string): Promise<unknown> => {
    await startStoryMocks(["a"], load, quiet);
    if (firstResolver === undefined) throw new Error("no handler came before the story's");
    return firstResolver({ request: { referrer } });
  };

  it("sends on to the network what the frame of another story asks", async () => {
    expect(await answerFor("http://localhost:5173/frame.html?story=kit%3Aprofile--empty")).toBe(PASSTHROUGH);
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
    expect(await answerFor("http://localhost:5173/frame.html?story=kit%3Aprofile--empty")).toBe(PASSTHROUGH);
  });

  it("leaves to its handlers a request whose sender cannot be told", async () => {
    expect(await answerFor("")).toBeUndefined();
    expect(await answerFor("about:client")).toBeUndefined();
    expect(await answerFor("http://localhost:5173/assets/worker.js")).toBeUndefined();
  });
});
