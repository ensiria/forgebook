/**
 * The elements of a story that spill out of their parent: what overlaps a neighbour or runs off the frame when the
 * story is narrower than it was drawn for.
 *
 * @remarks
 * Runs in the story's page (`page.evaluate`), so it takes no import. An element spills when its box reaches past its
 * parent's box by more than a pixel, sideways, and the parent shows its overflow: a parent that clips or scrolls
 * (`overflow` other than `visible`) and an element taken out of the flow (`absolute`, `fixed`) are left out, as is
 * anything inside a frame-level layer (`data-forgebook-allow-spill`, for a story that shows a spill on purpose).
 *
 * @module
 */

/** One spill: the element, its parent, and by how many pixels it reaches past. */
export type Spill = {
  /** The element, as a short CSS path (`div.story-settings`). */
  readonly element: string;
  /** Its parent, the same way. */
  readonly parent: string;
  /** How far it reaches past the parent, in CSS px. */
  readonly by: number;
};

/**
 * The spills inside a root, measured in the page.
 *
 * @param rootSelector - the story's root (`.forgebook-frame`).
 */
export const findSpills = (rootSelector: string): Spill[] => {
  const pathOf = (element: Element): string => {
    const classes = [...element.classList].slice(0, 2).join(".");
    return classes === "" ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}.${classes}`;
  };
  // an element out of the flow, a parent that clips or scrolls, and an allowed spill are not measured
  const isMeasured = (element: Element, parent: Element): boolean => {
    if (element.closest("[data-forgebook-allow-spill]") !== null) return false;
    const style = getComputedStyle(element);
    const parentStyle = getComputedStyle(parent);
    return (
      style.position !== "absolute" &&
      style.position !== "fixed" &&
      style.display !== "contents" &&
      parentStyle.display !== "contents" &&
      parentStyle.overflowX === "visible"
    );
  };
  const overreach = (element: Element, parent: Element): number => {
    const box = element.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return 0;
    return Math.max(box.right - parentBox.right, parentBox.left - box.left);
  };
  const root = document.querySelector(rootSelector);
  if (root === null) return [];
  return [...root.querySelectorAll("*")].flatMap((element) => {
    const parent = element.parentElement;
    if (parent === null || !isMeasured(element, parent)) return [];
    const by = overreach(element, parent);
    return by > 1 ? [{ element: pathOf(element), parent: pathOf(parent), by: Math.round(by) }] : [];
  });
};
