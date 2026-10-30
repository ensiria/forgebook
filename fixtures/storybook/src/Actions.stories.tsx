/**
 * Actions: a spy from storybook/test and an argTypes action, recorded in the Events tab; the play still reads the
 * spy.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "./Button";

const meta = {
  title: "Storybook/Actions",
  component: Button,
  args: { label: "Press", onClick: fn() }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A spy as the handler: pressed by the play, which checks the spy's calls. */
export const Spy: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  }
};

/** An action named by the arg types, on an arg the component does not type. */
export const Named: StoryObj<{ readonly onClose: () => void }> = {
  argTypes: { onClose: { action: "closed" } },
  render: (args) => (
    <button type="button" onClick={() => args.onClose()}>
      Close
    </button>
  )
};
