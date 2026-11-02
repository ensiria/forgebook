/**
 * The changes the device menu makes to the view: a model chosen, the device turned. The address keeps only what
 * differs from the page's default, as the toggle does (`deviceView.ts`).
 *
 * @remarks
 * Apart from `deviceView.ts`, which the shell's first load reads: only the menu, which comes with the device's parts,
 * uses these. Pure.
 *
 * @module
 */
import type { DeviceOrientation } from "@forgebook/story-format/csf";

import type { DeviceDefault, DeviceId, DeviceView, ShownDevice } from "./deviceView.ts";

/**
 * The view with a model chosen: `auto` when it is the one the story shows by default, so the address stays short.
 *
 * @param view - the view.
 * @param story - the story's default.
 * @param model - the chosen model.
 */
export const withModel = <View extends DeviceView>(
  view: View,
  story: DeviceDefault,
  model: DeviceId
): View => ({
  ...view,
  device: story.isFramed && story.model === model ? "auto" : model
});

/**
 * The view with the device turned the other way: `auto` when that is the story's own orientation.
 *
 * @param view - the view.
 * @param story - the story's default.
 * @param shown - the device shown now.
 */
export const withTurn = <View extends DeviceView>(
  view: View,
  story: DeviceDefault,
  shown: ShownDevice
): View => {
  const turned: DeviceOrientation = shown.orientation === "portrait" ? "landscape" : "portrait";
  return { ...view, orientation: turned === story.orientation ? "auto" : turned };
};
