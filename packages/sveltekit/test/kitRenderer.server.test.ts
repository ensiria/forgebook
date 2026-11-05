/**
 * Tests for SvelteKit's renderer on a server: a page's load runs before the page is drawn as HTML, and its fetch of
 * the page's own origin is answered by the story's mock handlers, never by the network: what answers on the machine's
 * own address differs from one machine to the next (a Windows runner answers on `http://localhost`).
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { HttpResponse, http, passthrough } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { kitRenderer } from "../src/kitRenderer.ts";
import { mockHandlersOf } from "../src/loadFetch.ts";
import PostPage from "./components/PostPage.svelte";

/** A load's event, as much as these loads read. */
type LoadEvent = { readonly fetch: typeof globalThis.fetch };

/** A local server that counts what reaches it: a load's fetch must never get there. */
let server: Server;
/** The requests the local server got. */
let reached: string[] = [];
/** The local server's origin, given to a story's page so its paths point at it. */
let localOrigin = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    reached.push(request.url ?? "");
    response.end(JSON.stringify({ title: "from the network" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("The local server has no port");
  localOrigin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  reached = [];
  vi.restoreAllMocks();
});

/**
 * Every request the global `fetch` gets, which then fails: a request on the page's origin must not reach it.
 *
 * @returns the addresses asked.
 */
const spyOnNetwork = (): string[] => {
  const requested: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL): Promise<Response> => {
    requested.push(input instanceof Request ? input.url : String(input));
    return Promise.reject(new TypeError("fetch failed"));
  });
  return requested;
};

/**
 * A page's story drawn on a server.
 *
 * @param load - the page's load.
 * @param parameters - the story's other parameters (its mocks), and its page's address.
 */
const renderPage = async (
  load: (event: LoadEvent) => Promise<object>,
  { url = "/x", msw }: { readonly url?: string; readonly msw?: { readonly handlers: unknown } } = {}
): Promise<string> => {
  const story = readStory(
    {
      default: {
        title: "Pages/Post",
        component: PostPage,
        parameters: { sveltekit: { page: { url }, load }, ...(msw === undefined ? {} : { msw }) }
      },
      Plain: {}
    },
    "Plain"
  );
  if (typeof story === "string") throw new Error(story);
  const drawing: StoryDrawing = {
    identity: { id: "kit:pages-post--plain", name: "Plain", title: "Pages/Post" },
    story,
    args: {},
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
  return await kitRenderer.renderToString(drawing);
};

/**
 * A load that draws the title its API answers.
 *
 * @param input - what it fetches.
 */
const titleLoad =
  (input: string | URL | Request = "/api/title"): ((event: LoadEvent) => Promise<object>) =>
  async ({ fetch }: LoadEvent): Promise<object> => {
    const answer = await fetch(input);
    const body: unknown = await answer.json();
    return { title: typeof body === "object" && body !== null && "title" in body ? body.title : "?" };
  };

/** The story's handler of its title. */
const titleHandler = (title: string): unknown => http.get("/api/title", () => HttpResponse.json({ title }));

describe("a page's load drawn on a server", () => {
  it("is answered by the story's handler, the network never asked", async () => {
    const requested = spyOnNetwork();
    const html = await renderPage(titleLoad(), { msw: { handlers: [titleHandler("Mocked")] } });
    expect(html).toContain("<h1>Mocked</h1>");
    expect(requested).toEqual([]);
  });

  it("answers an absolute address, a URL and a Request on the page's origin too", async () => {
    const requested = spyOnNetwork();
    const handlers = [titleHandler("Mocked")];
    for (const input of [
      "http://localhost/api/title",
      new URL("http://localhost/api/title"),
      new Request("http://localhost/api/title")
    ]) {
      const html = await renderPage(titleLoad(input), { msw: { handlers } });
      expect(html).toContain("<h1>Mocked</h1>");
    }
    expect(requested).toEqual([]);
  });

  it("reads handlers given as a record of lists, as MSW's Storybook addon writes them", async () => {
    const html = await renderPage(titleLoad(), { msw: { handlers: { title: [titleHandler("Grouped")] } } });
    expect(html).toContain("<h1>Grouped</h1>");
  });

  it("fails with the address and what to give when no handler answers", async () => {
    const requested = spyOnNetwork();
    const rendered = renderPage(titleLoad("/api/title?id=1"), {
      msw: { handlers: [http.get("/api/other", () => HttpResponse.json({}))] }
    });
    await expect(rendered).rejects.toThrow(
      /GET http:\/\/localhost\/api\/title\?id=1 on a server.*parameters\.msw\.handlers.*serverData/
    );
    expect(requested).toEqual([]);
  });

  it("fails when the story has no mocks at all", async () => {
    const requested = spyOnNetwork();
    await expect(renderPage(titleLoad())).rejects.toThrow(/no mock of the story answers it/);
    expect(requested).toEqual([]);
  });

  it("fails when the load catches the error and draws something else", async () => {
    const load = async ({ fetch }: LoadEvent): Promise<object> => {
      const answer = await fetch("/api/title").catch(() => undefined);
      return { title: answer === undefined ? "offline" : "online" };
    };
    await expect(renderPage(load)).rejects.toThrow(/GET http:\/\/localhost\/api\/title/);
  });

  it("fails when a handler sends the request on to the network", async () => {
    const requested = spyOnNetwork();
    const rendered = renderPage(titleLoad(), {
      msw: { handlers: [http.get("/api/title", () => passthrough())] }
    });
    await expect(rendered).rejects.toThrow(/no mock of the story answers it/);
    expect(requested).toEqual([]);
  });

  it("never reaches a server listening on the page's origin", async () => {
    const page = `${localOrigin}/x`;
    await expect(renderPage(titleLoad(), { url: page })).rejects.toThrow(/no mock of the story answers it/);
    const html = await renderPage(titleLoad(), { url: page, msw: { handlers: [titleHandler("Mocked")] } });
    expect(html).toContain("<h1>Mocked</h1>");
    expect(reached).toEqual([]);
  });

  it("gives each of two renders at once its own story's answer", async () => {
    const htmls = await Promise.all([
      renderPage(titleLoad(), { msw: { handlers: [titleHandler("First")] } }),
      renderPage(titleLoad(), { msw: { handlers: [titleHandler("Second")] } })
    ]);
    expect(htmls[0]).toContain("<h1>First</h1>");
    expect(htmls[1]).toContain("<h1>Second</h1>");
  });

  it("answers a once handler again in each render, as each frame is a page of its own", async () => {
    const handlers = [http.get("/api/title", () => HttpResponse.json({ title: "Once" }), { once: true })];
    for (const _ of [1, 2])
      expect(await renderPage(titleLoad(), { msw: { handlers } })).toContain("<h1>Once</h1>");
  });

  it("rejects the fetch a handler answers with a network error", async () => {
    const load = async ({ fetch }: LoadEvent): Promise<object> => {
      const answer = await fetch("/api/title").catch((error: unknown) => error);
      return { title: answer instanceof TypeError ? "offline" : "online" };
    };
    const html = await renderPage(load, {
      msw: { handlers: [http.get("/api/title", () => HttpResponse.error())] }
    });
    expect(html).toContain("<h1>offline</h1>");
  });

  it("follows a mocked redirect through the handlers", async () => {
    const requested = spyOnNetwork();
    const handlers = [
      http.get(
        "/api/old-title",
        () => new HttpResponse(null, { status: 302, headers: { location: "/api/title" } })
      ),
      titleHandler("Moved")
    ];
    expect(await renderPage(titleLoad("/api/old-title"), { msw: { handlers } })).toContain("<h1>Moved</h1>");
    expect(requested).toEqual([]);
  });

  it("gives a handler the request's method and body, its path read under the base path", async () => {
    const load = async ({ fetch }: LoadEvent): Promise<object> => {
      const answer = await fetch("/api/echo", { method: "POST", body: JSON.stringify({ title: "Sent" }) });
      const body: unknown = await answer.json();
      return { title: typeof body === "object" && body !== null && "title" in body ? body.title : "?" };
    };
    const handlers = [http.post("/api/echo", async ({ request }) => HttpResponse.json(await request.json()))];
    expect(await renderPage(load, { url: "http://localhost/docs/x", msw: { handlers } })).toContain(
      "<h1>Sent</h1>"
    );
  });

  it("fetches an address on another origin as it is", async () => {
    const requested = spyOnNetwork();
    const load = async ({ fetch }: LoadEvent): Promise<object> => {
      const answer = await fetch("https://api.example.com/title").catch(() => undefined);
      return { title: answer === undefined ? "offline" : "online" };
    };
    expect(await renderPage(load)).toContain("<h1>offline</h1>");
    expect(requested).toEqual(["https://api.example.com/title"]);
  });
});

describe("mockHandlersOf", () => {
  it("reads a list, a record of lists, and nothing", () => {
    expect(mockHandlersOf({ msw: { handlers: ["a", "b"] } })).toEqual(["a", "b"]);
    expect(mockHandlersOf({ msw: { handlers: { users: ["a"], posts: ["b", "c"] } } })).toEqual([
      "a",
      "b",
      "c"
    ]);
    expect(mockHandlersOf({})).toEqual([]);
    expect(mockHandlersOf({ msw: "none" })).toEqual([]);
  });
});
