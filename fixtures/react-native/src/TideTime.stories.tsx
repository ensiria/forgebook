/**
 * The next high tide, in a font Expo loads.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";

import { TideTime } from "./TideTime";

export default {
  title: "Today/Tide time",
  component: TideTime,
  args: { time: "14:32", height: 4.2 }
} satisfies Meta<typeof TideTime>;

/** The afternoon's tide. */
export const Afternoon: Story<typeof TideTime> = {};
