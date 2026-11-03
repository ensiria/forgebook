/**
 * The icon button, its glyph from Ionicons' font as `@expo/vector-icons` loads it.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";

import { IconButton } from "./IconButton";

export default {
  title: "Controls/Icon button",
  component: IconButton,
  parameters: { layout: "centered" },
  args: { icon: "boat", label: "Boats" }
} satisfies Meta<typeof IconButton>;

/** A boat, at the default size. */
export const Boat: Story<typeof IconButton> = {};

/** An anchor, larger. */
export const LargeAnchor: Story<typeof IconButton> = {
  args: { icon: "navigate", label: "Navigate", size: 40 }
};
