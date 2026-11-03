/**
 * A component written in two files with one title, as Storybook merges them (this file and `MergedMore.stories.tsx`),
 * and stories whose value is no object written in place: a helper's result and another constant.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

const meta = {
  title: "Storybook/Merged",
  component: Button,
  args: { label: "Merged" }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A story with the given label, as a library's helper makes its stories.
 *
 * @param label - the button's label.
 */
const labelled = (label: string): Story => ({ args: { label } });

/** The first file's story. */
export const Overview: Story = {};

/** A story a helper made: listed, though the index cannot read its value. */
export const Made = labelled("Made by a helper");

const template: Story = { args: { label: "From another constant" }, parameters: { layout: "centered" } };

/** A story that is another constant of the file. */
export const Aliased: Story = template;
