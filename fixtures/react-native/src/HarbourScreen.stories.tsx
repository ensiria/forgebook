/**
 * The harbour's whole screen, filling the frame as a screen fills a phone.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";

import { HarbourScreen } from "./HarbourScreen";

export default {
  title: "Screens/Harbour",
  component: HarbourScreen,
  parameters: { layout: "fullscreen" },
  args: {
    harbour: "Port Ellen",
    knots: 14,
    tasks: [
      { id: "ropes", title: "Check the mooring ropes" },
      { id: "fuel", title: "Log the fuel" }
    ]
  }
} satisfies Meta<typeof HarbourScreen>;

/** A breezy morning. */
export const Morning: Story<typeof HarbourScreen> = {};
