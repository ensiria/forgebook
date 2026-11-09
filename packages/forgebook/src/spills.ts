/**
 * The elements of a story that spill out of their parent: what overlaps a neighbour or runs off the frame when the
 * story is narrower than it was drawn for.
 *
 * @remarks
 * Runs in the story's page (`page.evaluate`), so it takes no import. An element spills when its box reaches past its
 * parent's box by more than a pixel, sideways, and the parent shows its overflow: a parent that clips or scrolls
 * (`overflow` other than `visible`) and an element taken out of the flow (`absolute`, `fixed`) are left out, as is
 * anything inside a frame-level layer (`data-forgebook-allow-spill`, for a story that shows a spill on purpose). An
 * inline element is measured by what it draws, its words and its own boxes: the white space a line ends with at a soft
 * wrap, which `white-space: pre-wrap` (a text editor's) lets hang past the line's end, draws nothing and is no spill. The
 * same finder serves the browser tests (`@forgebook/testing`) and the frame's outline of a worst case, so both find the
 * same spills; the frame passes an attribute to mark the elements with, which a style sheet outlines.
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
 * @param markAttribute - an attribute set on each element that spills, taken off the others first; none marks nothing.
 */
export const findSpills = (rootSelector: string, markAttribute?: string): Spill[] => {
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
  // what an inline element draws, sideways: its words and its own boxes, without the white space a line ends with at a
  // soft wrap, which `pre-wrap` lets hang past the line's end and which draws nothing
  const range = document.createRange();
  // what draws a box of its own whatever its display: an image, a control, an embedded document, an SVG
  const replaced = [
    "IMG",
    "VIDEO",
    "CANVAS",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "BUTTON"
  ];
  const isTextual = (element: Element): boolean =>
    element instanceof HTMLElement &&
    !replaced.includes(element.tagName) &&
    getComputedStyle(element).display === "inline";
  // the span from the leftmost to the rightmost of some extents; none when none is given
  const union = (
    extents: readonly ({ readonly left: number; readonly right: number } | undefined)[]
  ): { readonly left: number; readonly right: number } | undefined => {
    const given = extents.filter((extent) => extent !== undefined);
    if (given.length === 0) return undefined;
    return {
      left: Math.min(...given.map((extent) => extent.left)),
      right: Math.max(...given.map((extent) => extent.right))
    };
  };
  // a text's runs of letters, line by line: a word broken across two lines gives a box on each
  const wordsExtent = (text: Text): { readonly left: number; readonly right: number } | undefined =>
    union(
      [...text.data.matchAll(/\S+/g)].flatMap((word) => {
        range.setStart(text, word.index);
        range.setEnd(text, word.index + word[0].length);
        return [...range.getClientRects()]
          .filter((rect) => rect.width > 0)
          .map((rect) => ({ left: rect.left, right: rect.right }));
      })
    );
  const drawnExtent = (element: Element): { readonly left: number; readonly right: number } | undefined => {
    if (!isTextual(element)) {
      const box = element.getBoundingClientRect();
      return box.width === 0 && box.height === 0 ? undefined : { left: box.left, right: box.right };
    }
    return union(
      [...element.childNodes].map((node) => {
        if (node instanceof Element) return drawnExtent(node);
        return node instanceof Text ? wordsExtent(node) : undefined;
      })
    );
  };
  const overreach = (element: Element, parent: Element): number => {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return 0;
    const parentBox = parent.getBoundingClientRect();
    const past = Math.max(box.right - parentBox.right, parentBox.left - box.left);
    // only an inline element's box can hold hanging white space; measured anew only when its box reaches past
    if (past <= 1 || !isTextual(element)) return past;
    const drawn = drawnExtent(element);
    return drawn === undefined ? 0 : Math.max(drawn.right - parentBox.right, parentBox.left - drawn.left);
  };
  const root = document.querySelector(rootSelector);
  if (root === null) return [];
  const elements = [...root.querySelectorAll("*")];
  // the marks of the last measure come off first, so an element that no longer spills loses its outline
  if (markAttribute !== undefined) for (const element of elements) element.removeAttribute(markAttribute);
  return elements.flatMap((element) => {
    const parent = element.parentElement;
    if (parent === null || !isMeasured(element, parent)) return [];
    const by = overreach(element, parent);
    if (by <= 1) return [];
    if (markAttribute !== undefined) element.setAttribute(markAttribute, "");
    return [{ element: pathOf(element), parent: pathOf(parent), by: Math.round(by) }];
  });
};
