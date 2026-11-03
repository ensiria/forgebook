/**
 * The search's stories: the words come from the story's search params, and a search moves the route.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nextjs";

import { SearchBox } from "./SearchBox";

export default { title: "Site/Search", component: SearchBox } satisfies Meta<typeof SearchBox>;

/** Nothing searched yet. */
export const Empty: Story<typeof SearchBox> = {};

/** On the results of a search. */
export const WithResults: Story<typeof SearchBox> = {
  parameters: { nextjs: { navigation: { pathname: "/search", query: { q: "tides" } } } }
};
