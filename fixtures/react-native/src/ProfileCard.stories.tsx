/**
 * The crew member's card: its tones, online or not, and Follow pressed.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { ProfileCard } from "./ProfileCard";

export default {
  title: "Crew/Profile card",
  component: ProfileCard,
  args: { name: "Ada Brennan", role: "First mate" }
} satisfies Meta<typeof ProfileCard>;

/** A member offline, on the plain card. */
export const Plain: Story<typeof ProfileCard> = {};

/** A member online, on the accent card. */
export const Online: Story<typeof ProfileCard> = { args: { isOnline: true, tone: "accent" } };

/** Follow pressed: the card calls `onFollow` with the member's name, which the Events tab lists. */
export const Follows: Story<typeof ProfileCard> = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Follow" }));
  }
};
