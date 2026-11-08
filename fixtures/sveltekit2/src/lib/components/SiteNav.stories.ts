/**
 * The site's header on the page a story names, through SvelteKit 2's `page` store: its links follow the page's
 * address, and a link clicked moves the story's page, not the frame.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/sveltekit";

import SiteNav from "./SiteNav.svelte";

export default {
  title: "Layout/Site nav",
  component: SiteNav
} satisfies Meta<typeof SiteNav>;

/** On the home page. */
export const Default: Story<typeof SiteNav> = {};

/** On the about page: its link is the current one. */
export const OnAbout: Story<typeof SiteNav> = {
  parameters: { sveltekit: { page: { url: "/about" } } }
};

/** A link clicked: the story's page moves to the post, and its link becomes the current one. */
export const FollowsLink: Story<typeof SiteNav> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("link", { name: "First post" }));
  }
};
