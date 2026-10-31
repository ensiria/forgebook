/**
 * The carousel touch demo: swipe from photo to photo, or use the arrows with a mouse.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { Carousel } from "./touchDemos/Carousel";

export default {
  title: "Touch demos/Carousel",
  component: Carousel,
  args: { label: "Places" }
} satisfies Meta<typeof Carousel>;

/** Swipe sideways: it snaps to each photo; the dots follow. */
export const Places: Story<typeof Carousel> = { parameters: { main: true, height: 320 } };
