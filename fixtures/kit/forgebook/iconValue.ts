/**
 * The icon picker's frame module: the name the panel keeps turned into the kit's icon the story receives, and a story's
 * own icon turned back into its name, so the picker shows the icon the story draws.
 *
 * @module
 */
import type { ArgControlFrameModule } from "forgebook/arg-control";

import { ICONS } from "../src/icons";

/**
 * The icon a name names; none for a name the kit does not have.
 *
 * @param value - the panel's value: an icon's name.
 */
export const toStoryValue: ArgControlFrameModule["toStoryValue"] = (value) =>
  typeof value === "string" && Object.hasOwn(ICONS, value) ? ICONS[value] : undefined;

/**
 * The name of one of the kit's icons; none for anything else.
 *
 * @param value - the story's own value.
 */
export const toPanelValue: NonNullable<ArgControlFrameModule["toPanelValue"]> = (value) =>
  Object.entries(ICONS).find(([, icon]) => icon === value)?.[0];
