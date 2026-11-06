/**
 * Custom controls, registered by name in the catalogue's configuration: one that works, and one for each way one can fail.
 * Beside them a text, so a test sees the panel go on working.
 *
 * @module
 */
import type { ArgType } from "@forgebook/story-format/csf";

/** Each arg's control. */
const argTypes: Readonly<Record<string, ArgType>> = {
  rating: { control: { type: "rating", settings: { stars: 7 } }, description: "Stars." },
  failing: { control: "failing" },
  gone: { control: "gone" },
  unschemed: { control: "unschemed" },
  nobody: { control: "nobody" },
  wrong: { control: "wrongValue" },
  title: { control: "text" }
};

export default {
  title: "Storybook/Custom controls",
  argTypes,
  render: (args: Readonly<Record<string, unknown>>) => (
    <output data-testid="args">{JSON.stringify(args)}</output>
  )
};

/** A rating the story starts from. */
export const Rated = { args: { rating: 3, title: "Rated" } };
