/**
 * The pull-to-refresh touch demo: pull the feed down from its top and let go. It is deprecated by its meta's tag
 * only, which its TSDoc does not say.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/react";

import { PullToRefresh } from "./touchDemos/PullToRefresh";

export default {
  title: "Touch demos/Pull to refresh",
  tags: ["deprecated"],
  parameters: { touch: true },
  component: PullToRefresh,
  args: { title: "Friends" }
} satisfies Meta<typeof PullToRefresh>;

/** At the top, pull down past the line and let go: a new post arrives; a mouse uses Refresh. */
export const Friends: Story<typeof PullToRefresh> = { parameters: { main: true, height: 460 } };
