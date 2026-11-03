/**
 * A search box driving `$app/navigation`: `goto` moves the story's page, `afterNavigate` and `beforeNavigate` run as
 * in the app.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/sveltekit";

import SearchBox from "./SearchBox.svelte";

export default {
  title: "Navigation/Search box",
  component: SearchBox
} satisfies Meta<typeof SearchBox>;

/** On a page that has a query already. */
export const WithQuery: Story<typeof SearchBox> = {
  parameters: { sveltekit: { page: { url: "/search?q=forms" } } }
};

/** A search sent: `goto` takes the page to its results. */
export const Searches: Story<typeof SearchBox> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Search" }), "svelte");
    await userEvent.click(canvas.getByRole("button", { name: "Search" }));
  }
};
