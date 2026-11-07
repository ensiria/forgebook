/**
 * A Storybook file with no title: Forgebook places it by its path, as Storybook's auto-title does. Its tags keep
 * one story out of the lists and one out of the generated tests, and tags of its own for the sidebar's filter.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../../Button";

const meta = {
  component: Button,
  tags: ["autodocs"],
  args: { label: "Button" }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The loud button. */
export const Primary: Story = { tags: ["beta"], args: { variant: "primary" } };

/** The quiet button. */
export const Secondary: Story = { tags: ["beta", "wip"], args: { variant: "secondary", label: "Secondary" } };

/** Listed nowhere: tagged `!dev`, it opens only by its address. */
export const Unlisted: Story = { tags: ["!dev"], args: { label: "Unlisted" } };

/** Left out of the generated tests: tagged `!test`. */
export const Untested: Story = { tags: ["!test", "stable"], args: { label: "Untested" } };
