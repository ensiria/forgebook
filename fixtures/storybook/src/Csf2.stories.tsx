/**
 * CSF 2: stories written as functions, their name, args and parameters assigned after them.
 *
 * @module
 */
import type { Meta, StoryFn } from "@storybook/react-vite";

import { Button, type ButtonProps } from "./Button";

export default {
  title: "Storybook/CSF 2",
  component: Button
} satisfies Meta<typeof Button>;

const Template: StoryFn<ButtonProps> = (args) => <Button {...args} />;

/** A story bound from the template, named by `storyName`. */
export const Primary = Template.bind({});
Primary.storyName = "The primary one";
Primary.args = { label: "From a function", variant: "primary" };

/** A story bound from the template, with parameters of its own. */
export const Large = Template.bind({});
Large.args = { label: "Large", size: "large" };
Large.parameters = { layout: "centered" };
