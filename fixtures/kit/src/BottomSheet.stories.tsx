/**
 * The bottom sheet touch demo: drag the handle between three heights, or flick it.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { BottomSheet } from "./touchDemos/BottomSheet";

export default {
  title: "Touch demos/Bottom sheet",
  component: BottomSheet,
  args: { title: "Nearby" }
} satisfies Meta<typeof BottomSheet>;

/** Drag the handle up and down; a quick flick goes to the next height; a tap steps through them. */
export const Nearby: Story<typeof BottomSheet> = { parameters: { main: true, height: 460 } };
