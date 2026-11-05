/**
 * Tests for a story's mocks on a server: the handlers read from its parameters, and what counts as a page's own server.
 * The answers themselves are tried with MSW in the adapters' server tests (`@forgebook/sveltekit`, `@forgebook/nextjs`).
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isOnPageOrigin, mockedFetch, mockHandlersOf, type ServerMocks } from "../src/storyMocks.ts";

describe("mockHandlersOf", () => {
  it("finds none in a story without any", () => {
    expect(mockHandlersOf({})).toEqual([]);
    expect(mockHandlersOf({ msw: {} })).toEqual([]);
    expect(mockHandlersOf({ msw: "none" })).toEqual([]);
    expect(mockHandlersOf({ msw: { handlers: [] } })).toEqual([]);
  });

  it("reads a list, or a record of lists, as MSW's Storybook addon writes them", () => {
    expect(mockHandlersOf({ msw: { handlers: ["a", "b"] } })).toEqual(["a", "b"]);
    expect(mockHandlersOf({ msw: { handlers: { users: ["a"], posts: ["b", "c"] } } })).toEqual([
      "a",
      "b",
      "c"
    ]);
  });
});

describe("isOnPageOrigin", () => {
  const Local = new URL("http://localhost/x");

  it.each([
    "http://localhost/api",
    "http://127.0.0.1/api",
    "http://127.1.2.3/api",
    "http://[::1]/api",
    // `URL` writes these as 127.0.0.1
    "http://127.1/api",
    "http://0x7f.0.0.1/api",
    "http://2130706433/api",
    "http://LOCALHOST/api",
    "http://localhost./api",
    "http://app.localhost/api",
    "http://0.0.0.0/api",
    "http://[::]/api",
    "http://[::ffff:127.0.0.1]/api"
  ])("takes %s as a localhost page's server", (address) => {
    expect(isOnPageOrigin(new URL(address), Local)).toBe(true);
  });

  it.each([
    "https://localhost/api",
    "http://localhost:3000/api",
    "http://127.0.0.1:3000/api",
    "http://[::1]:3000/api",
    "http://127.example.com/api",
    "http://127.0.0.1.example.com/api",
    "http://localhost.example.com/api",
    "http://notlocalhost/api",
    "http://[::ffff:10.0.0.1]/api",
    "https://api.example.com/api"
  ])("takes %s as another server", (address) => {
    expect(isOnPageOrigin(new URL(address), Local)).toBe(false);
  });

  it("takes no loopback name as a page's on another host", () => {
    const page = new URL("https://shop.example.com/x");
    expect(isOnPageOrigin(new URL("https://shop.example.com/api"), page)).toBe(true);
    expect(isOnPageOrigin(new URL("https://127.0.0.1/api"), page)).toBe(false);
  });
});

describe("mockedFetch", () => {
  /** Mocks with no handlers, whose error names the request. */
  const unanswered = (loadMsw: () => Promise<unknown>, handlers: readonly unknown[] = []): ServerMocks => ({
    handlers,
    origin: "http://localhost",
    loadMsw,
    onUnanswered: (request: Request): Error => new Error(`unanswered ${request.url}`)
  });

  it("never loads MSW for a story with no handlers", async () => {
    let loads = 0;
    const send = mockedFetch(
      unanswered(async () => {
        loads += 1;
        return {};
      })
    );
    await expect(send(new Request("https://api.example.com/x"))).rejects.toThrow(
      "unanswered https://api.example.com/x"
    );
    expect(loads).toBe(0);
  });

  it("keeps a redirect's credentials on its own origin, as fetch does", async () => {
    /** MSW's core, redirecting the first request to the address it is given. */
    const redirecting = (location: string): (() => Promise<unknown>) => {
      const heard: Request[] = [];
      return async () => ({
        getResponse: async (_handlers: unknown[], request: Request): Promise<Response | undefined> => {
          heard.push(request);
          if (heard.length === 1) return new Response(null, { status: 307, headers: { location } });
          lastHeard = request;
          return new Response("done");
        }
      });
    };
    let lastHeard: Request | undefined;
    const headers = { authorization: "Bearer secret", cookie: "a=b", "x-other": "kept" };
    const start = "https://api.example.com/x";
    await mockedFetch(unanswered(redirecting("https://other.example.com/y"), ["handler"]))(
      new Request(start, { headers })
    );
    expect(lastHeard?.headers.get("authorization")).toBeNull();
    expect(lastHeard?.headers.get("cookie")).toBeNull();
    expect(lastHeard?.headers.get("x-other")).toBe("kept");
    await mockedFetch(unanswered(redirecting("/y"), ["handler"]))(new Request(start, { headers }));
    expect(lastHeard?.headers.get("authorization")).toBe("Bearer secret");
  });

  it("says what to install when MSW is missing, and when it is too old", async () => {
    const missing = mockedFetch(unanswered(() => Promise.reject(new Error("no module")), ["handler"]));
    await expect(missing(new Request("https://api.example.com/x"))).rejects.toThrow(
      "npm install --save-dev msw"
    );
    const old = mockedFetch(unanswered(() => Promise.resolve({}), ["handler"]));
    await expect(old(new Request("https://api.example.com/x"))).rejects.toThrow("MSW 2.11");
  });
});
