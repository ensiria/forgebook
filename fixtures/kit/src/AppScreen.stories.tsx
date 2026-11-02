/**
 * A phone app's screen, shown in a device by default: the fixture of the catalogue's device frames.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { AppScreen } from "./appScreen/AppScreen";

export default {
  title: "Layouts/App screen",
  component: AppScreen,
  args: { title: "Settings" },
  parameters: { layout: "fullscreen", device: { frame: true, model: "iphone-16" } }
} satisfies Meta<typeof AppScreen>;

/** The screen in an iPhone 16, as the meta sets it. */
export const Phone: Story<typeof AppScreen> = { parameters: { main: true } };

/** The same screen on its own: the story turns the meta's frame off. */
export const Unframed: Story<typeof AppScreen> = { parameters: { device: { frame: false } } };

/** The same screen in a Pixel 9 on its side. */
export const PixelLandscape: Story<typeof AppScreen> = {
  parameters: { device: { model: "pixel-9", orientation: "landscape" } }
};

/** The same screen in its iPhone, touched with the mouse: its device says so. */
export const Mouse: Story<typeof AppScreen> = { parameters: { device: { touch: false } } };
