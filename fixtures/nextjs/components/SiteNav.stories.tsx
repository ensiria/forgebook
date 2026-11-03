/**
 * The navigation's stories: the current link follows the story's route, and a click moves it.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nextjs";
import { storyRoute } from "@forgebook/nextjs/route";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { SiteNav } from "./SiteNav";

export default { title: "Site/Navigation", component: SiteNav } satisfies Meta<typeof SiteNav>;

/** On the home page. */
export const Home: Story<typeof SiteNav> = {};

/** On a post: Blog is the current section. */
export const OnPost: Story<typeof SiteNav> = {
  parameters: { nextjs: { navigation: { pathname: "/blog/tide-tables", params: { slug: "tide-tables" } } } }
};

/** A click on About moves the route, and the current link with it. */
export const GoesToAbout: Story<typeof SiteNav> = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("link", { name: "About" }));
    const { pathname, calls } = storyRoute();
    if (pathname !== "/about") throw new Error(`The route is ${pathname}, not /about`);
    if (calls.at(-1)?.name !== "router.push") throw new Error("The link did not push the route");
  }
};
