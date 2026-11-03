/**
 * What `tsc` must accept and refuse in a story's args: nothing runs this file, the type check is the test.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/html";

import type { ButtonArgs, createButton } from "./button";

/** A function's args. */
export const Accepted: Story<typeof createButton> = { args: { label: "A", tone: "danger", disabled: true } };

/** A type's args. */
export const ByType: Story<ButtonArgs> = { args: { label: "A" } };

/** A text arg takes a key of the catalogue's texts too. */
export const Keyed: Story<typeof createButton> = { args: { label: { storyText: "greeting.hello" } } };

/** A render receives the args typed. */
export const Rendered: Story<ButtonArgs> = { render: (args) => `<b>${args.label ?? ""}</b>` };

/** A value the function does not take. */
export const WrongValue: Story<typeof createButton> = {
  // @ts-expect-error a tone it does not have
  args: { tone: "loud" }
};

/** An arg the function does not take. */
export const WrongName: Meta<typeof createButton> = {
  // @ts-expect-error not an arg of the button
  args: { size: "large" }
};

/** A render must draw HTML or a node. */
export const WrongResult: Story<ButtonArgs> = {
  // @ts-expect-error a number is neither
  render: () => 3
};
