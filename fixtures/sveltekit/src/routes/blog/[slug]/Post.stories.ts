/**
 * The post page as SvelteKit draws it: its `load` run in the frame with the story's params, its `fetch` answered by the
 * story's mock, its data given to the page.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/sveltekit";
import { HttpResponse, http } from "msw";

import { load } from "./+page";
import Post from "./+page.svelte";

/** The post's API, mocked: a constant, since the story types name no `msw` parameter yet. */
const parameters = {
  sveltekit: { page: { url: "/blog/hello-world" }, load },
  msw: {
    handlers: [
      http.get("/api/posts/:slug", ({ params }) =>
        HttpResponse.json({ title: `Post ${String(params["slug"])}`, body: "Loaded by the page's load." })
      )
    ]
  }
};

export default {
  title: "Pages/Post",
  component: Post,
  parameters
} satisfies Meta<typeof Post>;

/** The page's load, run with the story's route; the generated server tests answer no fetch, so they leave it out. */
export const Loaded: Story<typeof Post> = { tags: ["!test"] };

/** The page's data given as it is, no load run: what a server load would have returned. */
export const FromData: Story<typeof Post> = {
  parameters: {
    sveltekit: {
      page: { url: "/blog/given", data: { post: { title: "A given post", body: "Given by the story." } } },
      load: []
    }
  }
};
