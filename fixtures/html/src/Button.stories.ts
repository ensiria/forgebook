/**
 * Every way an HTML story draws: the meta's function with its args, a render returning HTML, one returning a node.
 *
 * @module
 */
import "@forgebook/story-format/testing-library";

import type { Meta, Story } from "@forgebook/html";

import { createButton } from "./button";

export default {
  title: "Inputs/Button",
  component: createButton,
  args: { label: "Save" }
} satisfies Meta<typeof createButton>;

/** The function with its args. */
export const Default: Story<typeof createButton> = {
  args: { tone: "info" },
  parameters: { main: true }
};

/** A render that returns HTML, the args written into it. */
export const FromMarkup: Story<typeof createButton> = {
  render: (args) =>
    `<div class="toolbar" data-testid="toolbar">${createButton({ label: "Save", ...args }).outerHTML}<span>Toolbar</span></div>`
};

/** The press a person makes, recorded in the catalogue. */
export const Pressed: Story<typeof createButton> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
  }
};
