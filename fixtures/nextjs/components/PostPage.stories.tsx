/**
 * A post's page, a server component: awaited before it is drawn, its cookie from the story's request.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nextjs";

import { PostPage } from "./PostPage";

export default {
  title: "Blog/Post page",
  component: PostPage,
  args: { slug: "first-light" },
  parameters: { nextjs: { navigation: { pathname: "/blog/first-light", params: { slug: "first-light" } } } }
} satisfies Meta<typeof PostPage>;

/** A first visit. */
export const FirstVisit: Story<typeof PostPage> = {};

/** A reader the cookie names. */
export const ReturningReader: Story<typeof PostPage> = {
  parameters: { nextjs: { cookies: { reader: "Ada" } } }
};

/** A slug with no post: Next.js would draw the not-found page. */
export const Missing: Story<typeof PostPage> = { args: { slug: "no-such-post" } };
