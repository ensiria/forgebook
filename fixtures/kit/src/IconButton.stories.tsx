/**
 * The icon button's stories: one with no `argTypes`, whose `icon` the kit's icon picker sets, and one whose `argTypes`
 * name a control of their own for it, which the picker leaves alone.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { IconButton } from "./IconButton";
import { IconBell, IconHeart, IconSearch } from "./icons";

export default { title: "Actions/Icon button", component: IconButton } satisfies Meta<typeof IconButton>;

/** The button as a story writes it: its icon set by the kit's picker in the panel. */
export const Basic: Story<typeof IconButton> = { args: { icon: IconSearch, label: "Search" } };

/** The button with a choice of two icons its own `argTypes` name. */
export const OwnControl: Story<typeof IconButton> = {
  args: { icon: IconBell, label: "Notifications" },
  argTypes: {
    icon: { control: "radio", options: ["Bell", "Heart"], mapping: { Bell: IconBell, Heart: IconHeart } }
  }
};
