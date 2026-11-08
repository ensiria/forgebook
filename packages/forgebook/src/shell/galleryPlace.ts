/**
 * Where a gallery's menu sits: under its button, or over it when only there it fits, always inside the window. Pure.
 *
 * @module
 */

/** The room kept between the menu and its button or the window's edge, in CSS px. */
const GAP = 6;

/**
 * The menu's place, in CSS px from the window's corner.
 *
 * @param button - the button's box.
 * @param panel - the menu's size.
 * @param room - the window's size.
 * @returns where its top and left corner go.
 */
export const galleryPlace = (
  button: Pick<DOMRect, "top" | "bottom" | "left">,
  panel: Pick<DOMRect, "width" | "height">,
  room: { readonly width: number; readonly height: number }
): { readonly top: number; readonly left: number } => {
  const below = button.bottom + GAP;
  const above = button.top - GAP - panel.height;
  const isBelowFit = below + panel.height <= room.height - GAP;
  const top = isBelowFit || above < GAP ? below : above;
  return {
    // a menu taller than the room on both sides starts as high as it can and scrolls
    top: Math.max(GAP, Math.min(top, room.height - GAP - panel.height)),
    left: Math.max(GAP, Math.min(button.left, room.width - GAP - panel.width))
  };
};
