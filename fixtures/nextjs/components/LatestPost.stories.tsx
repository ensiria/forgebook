/**
 * The latest post, a server component that fetches: its `fetch` answered by the story's mock, in the frame and in the
 * generated server tests alike.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nextjs";
import { HttpResponse, http } from "msw";

import { LatestPost } from "./LatestPost";

export default {
  title: "Blog/Latest post",
  component: LatestPost
} satisfies Meta<typeof LatestPost>;

/** The blog's API answers with a post. */
export const Loaded: Story<typeof LatestPost> = {
  parameters: {
    msw: {
      handlers: [
        http.get("https://api.harbour.example/posts/latest", () =>
          HttpResponse.json({ title: "First light over the harbour" })
        )
      ]
    }
  }
};
