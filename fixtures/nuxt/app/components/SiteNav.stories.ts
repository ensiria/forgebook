/**
 * The site's navigation in a story: its route set by the story, a click on a link moving it, a link out recorded.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/nuxt";
import { storyNuxt } from "@forgebook/nuxt/story";

import SiteNav from "./SiteNav.vue";

export default { title: "Layout/SiteNav", component: SiteNav } satisfies Meta<typeof SiteNav>;

/** At the home page. */
export const Home: Story<typeof SiteNav> = {};

/** On a post, the route given by its page's name and params. */
export const OnPost: Story<typeof SiteNav> = {
  parameters: { nuxt: { route: { name: "blog-slug", params: { slug: "hello-world" } } } }
};

/** A click on a link moves the story's route, and the active link follows. */
export const GoesToAbout: Story<typeof SiteNav> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("link", { name: "About" }));
    await canvas.findByText("On /about");
    const { route, calls } = storyNuxt();
    if (route.name !== "about") throw new Error(`The route is ${String(route.name)}, not about`);
    if (!calls.some((call) => call.name === "router.push")) throw new Error("The move was not recorded");
  }
};
