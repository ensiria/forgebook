/**
 * How a file's exports become stories: data left out, an order of its own, a story exported under another name, a
 * description from the docs parameter, a name written by code, and a title deeper than three levels.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

const PREFIX = "Computed";

const meta = {
  title: "Storybook/Formats/Exports/Button",
  component: Button,
  excludeStories: ["sampleLabels"],
  args: { label: "Export" }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Shared data the file exports: not a story. */
export const sampleLabels = ["One", "Two"];

// eslint-disable-next-line jsdoc/require-jsdoc -- its description is its docs parameter, which a TSDoc would replace
export const Second: Story = {
  parameters: { docs: { description: { story: "Its description comes from the docs parameter." } } }
};

/** Named by code: the index cannot read the name, so the catalogue shows the export's. */
export const First: Story = { name: `${PREFIX} name` };

const base: Story = { args: { label: "Renamed" } };

/** A story exported under another name than its constant's. */
export { base as Renamed };

/** The stories' order, as Storybook's compilers write it. */
export const __namedExportsOrder = ["First", "Second", "Renamed"];
