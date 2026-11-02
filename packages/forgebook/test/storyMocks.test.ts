/**
 * Tests for a story's mocked API: what starts the worker, what stops it, and what never loads it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

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
});
