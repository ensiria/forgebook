/**
 * The skill's chip, styled with NativeWind's classes.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react-native-web";

import { TagChip } from "./TagChip";

export default {
  title: "Crew/Tag chip",
  component: TagChip,
  args: { label: "Navigation" }
} satisfies Meta<typeof TagChip>;

/** A skill among others. */
export const Plain: Story<typeof TagChip> = {};

/** The member's main skill, filled. */
export const Main: Story<typeof TagChip> = { args: { isMain: true } };
