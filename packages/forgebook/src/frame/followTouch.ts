/**
 * Follows the root's touch attribute: the simulation (`touchLayer.ts`) runs while it is set, and loads the first time
 * it is, since a story's page without the Touch switch never uses it.
 *
 * @module
 */
import { isRealTouchWindow } from "../realTouch.ts";

/** The root's attribute that turns the simulation on. */
const TOUCH_ATTRIBUTE = "data-forgebook-touch";

/**
 * Follows the attribute from now on.
 *
 * @param document - the frame's document.
 * @returns a promise that settles once the simulation runs, when the attribute is already set.
 */
export const followTouch = async (document: Document): Promise<void> => {
  let stop: (() => void) | undefined;
  // in Chromium's real touch window the pages see real touch: simulating it on top would send every touch twice
  const view = document.defaultView;
  if (view !== null && isRealTouchWindow(view)) return;
  const isOn = (): boolean => document.documentElement.hasAttribute(TOUCH_ATTRIBUTE);
  const update = async (): Promise<void> => {
    if (isOn() && stop === undefined) {
      const { startTouch } = await import("./touchLayer.ts");
      // the attribute may have gone, or another change started it, while the module loaded
      if (isOn() && stop === undefined) stop = startTouch(document);
    } else if (!isOn() && stop !== undefined) {
      stop();
      stop = undefined;
    }
  };
  new MutationObserver((): void => void update()).observe(document.documentElement, {
    attributeFilter: [TOUCH_ATTRIBUTE]
  });
  await update();
};
