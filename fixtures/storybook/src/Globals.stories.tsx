/**
 * What a story fixes of the view: a switch by its globals, the background and the width as Storybook writes them.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";

const meta = {
  title: "Storybook/Globals",
  component: Button,
  args: { label: "Fixed view" }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Dark, on paper, at the phone's width, whatever the toolbar says. */
export const Fixed: Story = {
  globals: { theme: "dark", backgrounds: { value: "paper" }, viewport: { value: "Phone L" } }
};

/** The background and width in Storybook's older parameters. */
export const FromParameters: Story = {
  parameters: { backgrounds: { default: "Paper" }, viewport: { defaultViewport: "560" } }
};
