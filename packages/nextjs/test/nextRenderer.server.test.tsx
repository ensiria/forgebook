// @vitest-environment node
/**
 * Tests for the Next.js renderer on a server: a story's server components awaited, and their `fetch` answered by its
 * mock handlers, never by the network, whatever the address: on a server every fetch is absolute.
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { bypass, delay, HttpResponse, http, passthrough } from "msw";
import { type ReactNode, Suspense, use } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import dynamic from "../src/next/dynamic.tsx";
import { nextRenderer } from "../src/nextRenderer.tsx";
import { withStoryFetch } from "../src/serverFetch.ts";

/** A local server that counts what reaches it: a render's fetch must never get there. */
let server: Server;
/** The requests the local server got. */
let reached: string[] = [];
/** The local server's origin. */
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
});

/**
 * The title an answer carries.
 *
 * @param answer - the answer, its body a JSON object with a title.
 */
const titleOf = async (answer: Response): Promise<string> => {
  const body: unknown = await answer.json();
  return typeof body === "object" && body !== null && "title" in body ? String(body.title) : "?";
};

/**
 * A server component that draws the title its API answers.
 *
 * @param input - what it fetches.
 * @param init - how.
 */
const TitlePage = (input: () => RequestInfo | URL, init?: RequestInit) => async (): Promise<ReactNode> => (
  <h1>{await titleOf(await fetch(input(), init))}</h1>
);

/**
 * A story's component drawn on a server.
 *
 * @param component - the component.
 * @param msw - the story's mocks.
 */
const renderStory = async (component: unknown, msw?: { readonly handlers: unknown }): Promise<string> => {
  const story = readStory(
    {
      default: { title: "Pages/Post", component, ...(msw === undefined ? {} : { parameters: { msw } }) },
      Plain: {}
    },
    "Plain"
  );
  if (typeof story === "string") throw new Error(story);
  const drawing: StoryDrawing = {
    identity: { id: "next:pages-post--plain", name: "Plain", title: "Pages/Post" },
    story,
    args: {},
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
  return await nextRenderer.renderToString(drawing);
};

/** The address these stories' API lives at. */
const API = "https://api.example.com/title";

/** The global `fetch` as a module holds it that took it when it loaded. */
const CAPTURED_FETCH: typeof globalThis.fetch = globalThis.fetch;

/** A server component with the API's title in it. */
const ApiTitle = TitlePage(() => API);

/** A server component with a server component in it. */
const Nesting = async (): Promise<ReactNode> => (
  <main>
    <ApiTitle />
  </main>
);

/** A server component that catches a failed fetch and draws what it can. */
const Caught = async (): Promise<ReactNode> => {
  const answer = await fetch(API).catch(() => undefined);
  return <h1>{answer === undefined ? "offline" : "online"}</h1>;
};

/** A component that fails while it renders. */
const Throws = (): ReactNode => {
  throw new Error("No post");
};

/** The failing component in a boundary. */
const ThrowsInBoundary = (): ReactNode => (
  <Suspense fallback="waiting">
    <Throws />
  </Suspense>
);

/** What `Waits` waits for. */
const CAME = Promise.resolve("Came");

/** A component that waits for its data while it renders. */
const Waits = (): ReactNode => <p>{use(CAME)}</p>;

/** What `LateFetch` got. */
const lateFetched = Promise.withResolvers<unknown>();

/** A component that fetches once its sibling has failed the render. */
const LateFetch = async (): Promise<ReactNode> => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  lateFetched.resolve(await fetch(`${localOrigin}/late`).catch((error: unknown) => error));
  return null;
};

/** The late one beside one that fails at once. */
const Failing = (): ReactNode => (
  <>
    <LateFetch />
    <Throws />
  </>
);

/** Three long sections, each in a boundary, waiting. */
const LongSections = (): ReactNode =>
  ["a", "b", "c"].map((name) => (
    <section key={name}>
      <Suspense fallback="waiting">
        <Waits />
        <p>{"text ".repeat(4000)}</p>
      </Suspense>
    </section>
  ));

/** The waiting component in a boundary. */
const WaitsInBoundary = (): ReactNode => (
  <Suspense fallback="waiting">
    <Waits />
  </Suspense>
);

/**
 * A handler of the API's title.
 *
 * @param title - what it answers.
 * @param address - where.
 */
const titleHandler = (title: string, address = API): unknown =>
  http.get(address, () => HttpResponse.json({ title }));

describe("a server component's fetch on a server", () => {
  it("is answered by the story's handler, at another origin too", async () => {
    const html = await renderStory(ApiTitle, { handlers: [titleHandler("Mocked")] });
    expect(html).toContain("<h1>Mocked</h1>");
  });

  it("waits for a server component inside a server component", async () => {
    expect(await renderStory(Nesting, { handlers: [titleHandler("Nested")] })).toContain(
      "<main><h1>Nested</h1></main>"
    );
  });

  it("takes a URL and a Request, and Next.js's own fetch options", async () => {
    const handlers = [titleHandler("Mocked")];
    for (const input of [new URL(API), new Request(API)])
      expect(
        await renderStory(
          TitlePage(() => input),
          { handlers }
        )
      ).toContain("<h1>Mocked</h1>");
    const nextOptions = { next: { revalidate: 60, tags: ["title"] }, cache: "force-cache" as const };
    expect(
      await renderStory(
        TitlePage(() => API, nextOptions),
        { handlers }
      )
    ).toContain("<h1>Mocked</h1>");
  });

  it("reads handlers given as a record of lists", async () => {
    const html = await renderStory(ApiTitle, { handlers: { title: [titleHandler("Mocked")] } });
    expect(html).toContain("<h1>Mocked</h1>");
  });

  it("answers this machine's address with a handler's path, on any port", async () => {
    const html = await renderStory(
      TitlePage(() => `${localOrigin}/api/title`),
      { handlers: [titleHandler("Mocked", "/api/title")] }
    );
    expect(html).toContain("<h1>Mocked</h1>");
    expect(reached).toEqual([]);
  });

  it("fails with the address and what to give when no handler answers", async () => {
    const failing = renderStory(ApiTitle, {
      handlers: [titleHandler("Other", "https://api.example.com/other")]
    });
    await expect(failing).rejects.toThrow(`GET ${API}`);
    await expect(failing).rejects.toThrow("parameters.msw.handlers");
  });

  it("fails when the story has no mocks at all", async () => {
    await expect(renderStory(TitlePage(() => API))).rejects.toThrow(`GET ${API}`);
  });

  it("fails when the component catches the error and draws something else", async () => {
    await expect(renderStory(Caught)).rejects.toThrow(`GET ${API}`);
  });

  it("fails when a handler sends the request on to the network", async () => {
    const address = `${localOrigin}/passed`;
    const handlers = [http.get(address, () => passthrough())];
    await expect(
      renderStory(
        TitlePage(() => address),
        { handlers }
      )
    ).rejects.toThrow(`GET ${address}`);
    expect(reached).toEqual([]);
  });

  it("fails when a handler asks the network itself, with bypass or a fetch of its own", async () => {
    const address = `${localOrigin}/bypassed`;
    const bypassing = [http.get(address, ({ request }) => fetch(bypass(request)))];
    await expect(
      renderStory(
        TitlePage(() => address),
        { handlers: bypassing }
      )
    ).rejects.toThrow(`GET ${address}`);
    const own = `${localOrigin}/own`;
    const fetching = [http.get(API, () => fetch(own))];
    await expect(
      renderStory(
        TitlePage(() => API),
        { handlers: fetching }
      )
    ).rejects.toThrow(`GET ${own}`);
    expect(reached).toEqual([]);
  });

  it("fails when a handler keeps fetching what it answers, rather than hanging the worker", async () => {
    const handlers = [http.get(API, () => fetch(API))];
    await expect(renderStory(ApiTitle, { handlers })).rejects.toThrow("keeps fetching");
  });

  it("fails on a path, which a server has no page to read from", async () => {
    const handlers = [titleHandler("Mocked", "/api/title")];
    await expect(
      renderStory(
        TitlePage(() => "/api/title"),
        { handlers }
      )
    ).rejects.toThrow("full address");
  });

  it("never reaches a server on this machine, whichever name it goes by", async () => {
    await expect(renderStory(TitlePage(() => `${localOrigin}/a`))).rejects.toThrow(`${localOrigin}/a`);
    const port = new URL(localOrigin).port;
    await expect(renderStory(TitlePage(() => `http://localhost:${port}/b`))).rejects.toThrow(
      `http://localhost:${port}/b`
    );
    expect(reached).toEqual([]);
  });

  it("gives each of two renders at once its own story's answer", async () => {
    const [first, second] = await Promise.all([
      renderStory(
        TitlePage(() => API),
        { handlers: [titleHandler("First")] }
      ),
      renderStory(
        TitlePage(() => API),
        { handlers: [titleHandler("Second")] }
      )
    ]);
    expect(first).toContain("<h1>First</h1>");
    expect(second).toContain("<h1>Second</h1>");
  });

  it("answers a once handler again in each render, as each frame is a page of its own", async () => {
    const handlers = [http.get(API, () => HttpResponse.json({ title: "Once" }), { once: true })];
    expect(
      await renderStory(
        TitlePage(() => API),
        { handlers }
      )
    ).toContain("<h1>Once</h1>");
    expect(
      await renderStory(
        TitlePage(() => API),
        { handlers }
      )
    ).toContain("<h1>Once</h1>");
  });

  it("rejects the fetch a handler answers with a network error", async () => {
    const handlers = [http.get(API, () => HttpResponse.error())];
    expect(await renderStory(Caught, { handlers })).toContain("<h1>offline</h1>");
  });

  it("follows a mocked redirect through the handlers", async () => {
    const handlers = [
      http.get(API, () => HttpResponse.redirect("https://api.example.com/moved", 307)),
      titleHandler("Moved", "https://api.example.com/moved")
    ];
    expect(
      await renderStory(
        TitlePage(() => API),
        { handlers }
      )
    ).toContain("<h1>Moved</h1>");
  });

  it("fails on a mocked redirect to an address no handler answers, the network never asked", async () => {
    const target = `${localOrigin}/moved`;
    const handlers = [http.get(API, () => HttpResponse.redirect(target, 302))];
    await expect(
      renderStory(
        TitlePage(() => API),
        { handlers }
      )
    ).rejects.toThrow(`GET ${target}`);
    expect(reached).toEqual([]);
  });
});

describe("the render's scope", () => {
  it("reaches the real fetch outside a render, whether the last one passed or failed", async () => {
    await renderStory(ApiTitle, { handlers: [titleHandler("Mocked")] });
    await expect(renderStory(ApiTitle)).rejects.toThrow();
    expect(await titleOf(await fetch(`${localOrigin}/after`))).toBe("from the network");
    expect(reached).toEqual(["/after"]);
  });

  it("answers a fetch a render makes after it ended, the network never asked", async () => {
    await expect(renderStory(Failing)).rejects.toThrow("No post");
    expect(await lateFetched.promise).toBeInstanceOf(Error);
    expect(reached).toEqual([]);
  });

  it("answers a fetch a module took before the first render", async () => {
    const answer = await withStoryFetch([titleHandler("Mocked")], () => CAPTURED_FETCH(API));
    expect(await titleOf(answer)).toBe("Mocked");
    await expect(withStoryFetch([], () => CAPTURED_FETCH(`${localOrigin}/held`))).rejects.toThrow("held");
    expect(reached).toEqual([]);
  });

  it("wraps again what replaced the wrapper, and keeps calling it outside a render", async () => {
    const wrapped = globalThis.fetch;
    const stub = async (): Promise<Response> => Response.json({ title: "Stub" });
    globalThis.fetch = stub;
    try {
      const inside = await withStoryFetch([titleHandler("Mocked")], async () => titleOf(await fetch(API)));
      expect(inside).toBe("Mocked");
      expect(await titleOf(await fetch(API))).toBe("Stub");
    } finally {
      globalThis.fetch = wrapped;
    }
  });

  it("lets a fetch outside the render reach the real fetch while one runs", async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const rendering = withStoryFetch([], async () => {
      await held;
      return "done";
    });
    // the render installs its wrapper once its storage is loaded
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await titleOf(await fetch(`${localOrigin}/outside`))).toBe("from the network");
    release();
    expect(await rendering).toBe("done");
    expect(reached).toEqual(["/outside"]);
  });

  it("keeps overlapping scopes apart: each fetch gets its own render's handlers", async () => {
    let releaseFirst = (): void => undefined;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const before = globalThis.fetch;
    const first = withStoryFetch([titleHandler("First")], async () => {
      await firstHeld;
      return titleOf(await fetch(API));
    });
    const second = await withStoryFetch([titleHandler("Second")], async () => titleOf(await fetch(API)));
    expect(second).toBe("Second");
    releaseFirst();
    expect(await first).toBe("First");
    expect(globalThis.fetch).toBe(before);
  });

  it("does not fail one scope for what another's fetch lacked", async () => {
    const answered = withStoryFetch([titleHandler("Mocked")], async () => titleOf(await fetch(API)));
    const missing = withStoryFetch([], async () => titleOf(await fetch(API)));
    expect(await answered).toBe("Mocked");
    await expect(missing).rejects.toThrow(`GET ${API}`);
  });
});

describe("the server render", () => {
  it("fails on an error inside a Suspense boundary", async () => {
    await expect(renderStory(ThrowsInBoundary)).rejects.toThrow("No post");
  });

  it("gives its answer without a fallback or React's scripts, what it waited for in place", async () => {
    const html = await renderStory(WaitsInBoundary);
    expect(html).toContain("<p>Came</p>");
    expect(html).not.toContain("waiting");
    expect(html).not.toContain("<script");
  });

  it("keeps a long section in place, as a chunk of its own would bring its fallback and a script", async () => {
    const html = await renderStory(LongSections);
    expect(html).toContain("<p>Came</p>");
    expect(html).not.toContain("waiting");
    expect(html).not.toContain("<script");
  });

  it("gives up on a story that never ends, and the next story draws", { timeout: 8000 }, async () => {
    const handlers = [
      http.get(API, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      })
    ];
    await expect(
      renderStory(
        TitlePage(() => API),
        { handlers }
      )
    ).rejects.toThrow("did not finish its server render");
    expect(await renderStory((): ReactNode => <p>Next</p>)).toContain("<p>Next</p>");
  });

  it("leaves a next/dynamic with ssr: false out, its module never loaded", async () => {
    let loads = 0;
    const Chart = dynamic(
      async () => {
        loads += 1;
        return (): ReactNode => <p>Chart</p>;
      },
      { ssr: false, loading: () => <p>Loading</p> }
    );
    const html = await renderStory((): ReactNode => <Chart />);
    expect(html).toContain("<p>Loading</p>");
    expect(loads).toBe(0);
  });

  it("waits for a next/dynamic the server renders", async () => {
    const Chart = dynamic(async () => (): ReactNode => <p>Chart</p>);
    expect(await renderStory((): ReactNode => <Chart />)).toContain("<p>Chart</p>");
  });
});
