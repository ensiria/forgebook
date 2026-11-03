/**
 * The second file of the `Storybook/Merged` component: its stories join the first file's, with this file's meta, and
 * one of them comes from another module.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

export default {
  title: "Storybook/Merged",
  component: Button,
  args: { label: "Second file", variant: "secondary" }
} satisfies Meta<typeof Button>;

/** The second file's own story. */
export const Wrapping: StoryObj<typeof Button> = {
  args: { label: "A label long enough to wrap in a narrow frame" }
};

/* eslint-disable no-restricted-syntax -- the fixture is a story file that re-exports a story, as Storybook's can */
/** A story another module writes, re-exported here. */
// biome-ignore lint/performance/noBarrelFile: the same: the re-export is what this fixture shows the catalogue
export { shared as Reexported } from "./sharedStories";
/* eslint-enable no-restricted-syntax */
