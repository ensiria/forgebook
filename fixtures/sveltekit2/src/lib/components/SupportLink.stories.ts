/**
 * The support link, imported through the app's `$ui` alias of `svelte.config.js`: its address from the public
 * variables SvelteKit 2 gives by their prefix.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/sveltekit";

import SupportLink from "$ui/SupportLink.svelte";

export default {
  title: "Layout/Support link",
  component: SupportLink
} satisfies Meta<typeof SupportLink>;

/** About a question. */
export const Default: Story<typeof SupportLink> = {};

/** About an order. */
export const AboutAnOrder: Story<typeof SupportLink> = { args: { topic: "an order" } };
