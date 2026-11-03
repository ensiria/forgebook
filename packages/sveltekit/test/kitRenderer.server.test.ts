/**
 * Tests for SvelteKit's renderer on a server: a page's load runs before the page is drawn as HTML, its relative fetch
 * read from the story's page.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import { readStory } from "forgebook/story-module";
import { describe, expect, it } from "vitest";

import { kitRenderer } from "../src/kitRenderer.ts";
import PostPage from "./components/PostPage.svelte";

describe("a page drawn on a server", () => {
  it("runs its load first, its fetch from the story's page, and draws its data", async () => {
    let fetched = "";
    const load = async ({ fetch }: { readonly fetch: typeof globalThis.fetch }): Promise<object> => {
      const answer = await fetch("/api/title").catch((error: unknown) => {
        fetched =
          error instanceof Error && error.cause instanceof Error ? error.cause.message : String(error);
        return undefined;
      });
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
    // the address was read from the story's page, so Node got as far as the network
    expect(fetched).not.toContain("Invalid URL");
  });
});
