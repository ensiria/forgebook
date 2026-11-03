/**
 * The pulsing beacon, animated by Reanimated in the browser.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";

import { BeaconPulse } from "./BeaconPulse";

export default {
  title: "Controls/Beacon pulse",
  component: BeaconPulse,
  parameters: { layout: "centered" }
} satisfies Meta<typeof BeaconPulse>;

/** A pulse a second, roughly. */
export const Steady: Story<typeof BeaconPulse> = {};
