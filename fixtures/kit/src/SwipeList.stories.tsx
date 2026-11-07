/**
 * The swipe list touch demo, one of a few realistic components to try the catalogue's Touch switch on (swipe, snap,
 * pinch and turn, drag a sheet, pull to refresh), each also usable with a mouse. One story is experimental, a status of
 * its own its component does not hold, and the component is deprecated in its TSDoc only.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { SwipeList } from "./touchDemos/SwipeList";

export default {
  title: "Touch demos/Swipe list",
  parameters: { touch: true },
  component: SwipeList,
  args: { title: "Inbox" }
} satisfies Meta<typeof SwipeList>;

/** Swipe a row left for Snooze and Archive (all the way archives it), right to mark it read; a mouse uses ⋯. */
export const Inbox: Story<typeof SwipeList> = { parameters: { main: true, height: 460 } };

/** The same list with touch on, whatever the toolbar says. */
export const InboxTouch: Story<typeof SwipeList> = {
  tags: ["experimental"],
  globals: { touch: "touch" },
  parameters: { height: 460 }
};
