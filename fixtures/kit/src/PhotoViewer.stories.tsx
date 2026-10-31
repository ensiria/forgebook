/**
 * The photo viewer touch demo: pan with one finger, pinch and turn with two (Shift), double tap to zoom.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { PhotoViewer } from "./touchDemos/PhotoViewer";

export default {
  title: "Touch demos/Photo viewer",
  component: PhotoViewer,
  args: { caption: "Sunset over the bay" }
} satisfies Meta<typeof PhotoViewer>;

/** Hold Shift to put two fingers down, then drag: the photo pinches and turns. */
export const Sunset: Story<typeof PhotoViewer> = { parameters: { main: true, height: 360 } };
