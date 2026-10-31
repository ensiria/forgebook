/**
 * The touch pad's stories: the surface the catalogue's touch tests press, drag and scroll, a story that draws only the
 * version that fits the pointer, and one that fixes touch.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { ReactNode } from "react";

import { TouchPad, type TouchPadProps } from "./TouchPad";

export default {
  title: "Interaction/Touch pad",
  component: TouchPad,
  args: { label: "Press me" }
} satisfies Meta<typeof TouchPad>;

/** The pad as the touch tests use it. */
export const Overview: Story<typeof TouchPad> = { parameters: { height: 420 } };

/** Only the version that fits the pointer: the story reads the Touch switch in its globals. */
export const ByPointer: Story<typeof TouchPad> = {
  render: (_args: Partial<TouchPadProps>, { globals }: StoryContext<Partial<TouchPadProps>>): ReactNode =>
    globals["touch"] === "touch" ? (
      <p>Swipe the row for its actions</p>
    ) : (
      <p>Open the row's menu for its actions</p>
    )
};

/** Touch, whatever the toolbar says: the story fixes the switch. */
export const TouchOnly: Story<typeof TouchPad> = { globals: { touch: "touch" }, parameters: { height: 420 } };
