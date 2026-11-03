/**
 * Tests for SvelteKit's renderer on a server: a page's load runs before the page is drawn as HTML, its relative fetch
 * read from the story's page. The network is not asked: what answers on the machine's own address differs from one
 * machine to the next (a Windows runner answers on `http://localhost`).
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import { readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it, vi } from "vitest";

import { kitRenderer } from "../src/kitRenderer.ts";
import PostPage from "./components/PostPage.svelte";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a page drawn on a server", () => {
  it("runs its load first, its fetch from the story's page, and draws its data", async () => {
    const requested: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL): Promise<Response> => {
      requested.push(input instanceof Request ? input.url : String(input));
      return Promise.reject(new TypeError("fetch failed"));
    });
    const load = async ({ fetch }: { readonly fetch: typeof globalThis.fetch }): Promise<object> => {
      const answer = await fetch("/api/title").catch(() => undefined);
      return { title: answer === undefined ? "offline" : "online" };
    };
    const story = readStory(
      {
        default: {
          title: "Pages/Post",
          component: PostPage,
          parameters: { sveltekit: { page: { url: "/x" }, load } }
        },
        Plain: {}
      },
      "Plain"
    );
    if (typeof story === "string") throw new Error(story);
    const html = await kitRenderer.renderToString({
      identity: { id: "kit:pages-post--plain", name: "Plain", title: "Pages/Post" },
      story,
      args: {},
      texts: {},
      clock: heldStoryClock(0),
      decorators: [],
      globals: {},
      loaded: {}
    });
    expect(html).toContain("<h1>offline</h1>");
    // the address is read from the story's page, whose origin is the catalogue's default
    expect(requested).toEqual(["http://localhost/api/title"]);
  });
});
