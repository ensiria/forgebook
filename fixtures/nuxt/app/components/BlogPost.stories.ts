/**
 * A post of the blog in a story: its data given by the story for its key, or answered by MSW, or missing.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/nuxt";
import { HttpResponse, http } from "msw";

import BlogPost from "./BlogPost.vue";

export default {
  title: "Blog/BlogPost",
  component: BlogPost,
  parameters: { nuxt: { route: "/blog/hello-world" } }
} satisfies Meta<typeof BlogPost>;

/**
 * The post the story gives `useAsyncData` for its key: no request goes out. A story's `nuxt` replaces the meta's, as
 * every parameter does, so it names its route too.
 */
export const FromStoryData: Story<typeof BlogPost> = {
  parameters: {
    nuxt: {
      route: "/blog/hello-world",
      data: { "post-hello-world": { title: "Hello from the story", status: "published" } }
    }
  }
};

/** The post the request gets, answered by the story's MSW handler. */
export const FromRequest: Story<typeof BlogPost> = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/posts/hello-world", () =>
          HttpResponse.json({ title: "Hello from MSW", status: "draft" })
        )
      ]
    }
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Hello from MSW" });
  }
};

/** A post the server does not have: the error `useAsyncData` returns. */
export const Missing: Story<typeof BlogPost> = {
  parameters: {
    nuxt: { route: { name: "blog-slug", params: { slug: "gone" } } },
    msw: { handlers: [http.get("/api/posts/gone", () => HttpResponse.json({}, { status: 404 }))] }
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("alert");
  }
};
