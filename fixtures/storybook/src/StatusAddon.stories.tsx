/**
 * A status written as Storybook's status addons write it, `parameters.status`: read as a tag, so a catalogue that
 * declares the status shows its badge.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

const meta = {
  title: "Storybook/Status addon",
  component: Button,
  args: { label: "Status" },
  parameters: { status: { type: "experimental" } }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The meta's status. */
export const Plain: Story = {};

/** Its own status replaces the meta's, as a story's parameter does. */
export const InReview: Story = { parameters: { status: "review" } };
