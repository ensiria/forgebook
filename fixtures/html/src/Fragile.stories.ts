/**
 * A story that breaks for one value: the frame shows its error and leaves it when the value changes back.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/html";

/** The fragile story's args. */
type FragileArgs = {
  /** A text; `boom` breaks it. */
  readonly text: string;
};

export default {
  title: "States/Fragile",
  render: ({ text = "" }) => {
    if (text === "boom") throw new Error("Fragile broke");
    return `<p data-testid="fragile">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
  }
} satisfies Meta<FragileArgs>;

/** A text that breaks for `boom`. */
export const Default: Story<FragileArgs> = { args: { text: "Fine" } };
