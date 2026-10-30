/**
 * The meta's render and play for every story of the file, and a component made by memo and forwardRef.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { forwardRef, memo } from "react";
import { expect, within } from "storybook/test";

/** A badge made by forwardRef and memo: an object, not a function. */
const Badge = memo(
  forwardRef<HTMLSpanElement, { readonly text: string }>(({ text }, ref) => (
    <span ref={ref} data-testid="badge">
      {text}
    </span>
  ))
);

const meta = {
  title: "Storybook/Meta render and play",
  component: Badge,
  args: { text: "Badge" },
  render: (args) => (
    <p>
      From the meta: <Badge {...args} />
    </p>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("badge")).toBeVisible();
  }
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Drawn and played by the meta. */
export const FromMeta: Story = {};

/** Its own render, the meta's play. */
export const OwnRender: Story = { render: (args) => <Badge {...args} /> };
