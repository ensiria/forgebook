/**
 * The frame's outline of the elements that spill out of their parents, while the shell asks for it: on while the
 * story's args are the worst case, so a long text that overlaps a neighbour shows where.
 *
 * @remarks
 * The spills are found as the browser tests find them (`forgebook/spills`), so the outline and the suite agree. They
 * are measured again after the story changes (its nodes, its text, a class or a style) and after it is resized, once a
 * frame at most, and the shell is told the count whenever it changes. The outline is a CSS outline, which takes no room,
 * in a fixed colour that reads over any theme.
 *
 * @module
 */
import { findSpills } from "../spills.ts";

/** The attribute the measure sets on each element that spills. */
const SPILL_ATTRIBUTE = "data-forgebook-spill";

/** The id of the style sheet that outlines them. */
const STYLE_ID = "forgebook-spill-style";

/** The outline of a spilling element. */
const SPILL_SHEET =
  `[${SPILL_ATTRIBUTE}] { outline: 2px dashed rgb(220 38 38) !important; ` +
  "outline-offset: -1px !important; background-color: rgb(220 38 38 / 0.08) !important; }";

/**
 * Starts the outline's control: a function that turns it on or off.
 *
 * @param document - the frame's document.
 * @param rootSelector - the story's root (`.forgebook-frame`).
 * @param onCount - called with the number of spills each time it changes while the outline is on.
 * @returns the switch.
 */
export const spillOutline = (
  document: Document,
  rootSelector: string,
  onCount: (count: number) => void
): ((isOn: boolean) => void) => {
  let stop: (() => void) | undefined;
  const start = (): (() => void) => {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = SPILL_SHEET;
    document.head.append(style);
    let lastCount: number | undefined;
    let pending: number | undefined;
    const measure = (): void => {
      pending = undefined;
      const count = findSpills(rootSelector, SPILL_ATTRIBUTE).length;
      if (count === lastCount) return;
      lastCount = count;
      onCount(count);
    };
    // the story's changes come in bursts (a render, a font): measured once, on the next frame
    const schedule = (): void => {
      pending ??= requestAnimationFrame(measure);
    };
    // the measure's own attribute is left out, or each mark would ask for another measure
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributeFilter: ["class", "style", "hidden"]
    });
    const resizes = new ResizeObserver(schedule);
    resizes.observe(document.body);
    schedule();
    return (): void => {
      mutations.disconnect();
      resizes.disconnect();
      if (pending !== undefined) cancelAnimationFrame(pending);
      style.remove();
      for (const element of document.querySelectorAll(`[${SPILL_ATTRIBUTE}]`))
        element.removeAttribute(SPILL_ATTRIBUTE);
    };
  };
  return (isOn: boolean): void => {
    if (isOn && stop === undefined) stop = start();
    else if (!isOn && stop !== undefined) {
      stop();
      stop = undefined;
    }
  };
};
