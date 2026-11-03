/**
 * The hero's stories: an image imported as Next.js imports it, drawn by Next.js's own image component.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/nextjs";

import { Hero } from "./Hero";

export default { title: "Site/Hero", component: Hero } satisfies Meta<typeof Hero>;

/** As the home page shows it. */
export const Default: Story<typeof Hero> = {};

/** Another caption. */
export const LowTide: Story<typeof Hero> = { args: { caption: "Low tide at 12:55" } };
