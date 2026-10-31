/**
 * The pinned controls a narrow toolbar has no room for: they stay in the View menu for as long as the bar is narrow,
 * the last pinned first, and come back when it widens, so the bar never wraps or squeezes a control.
 *
 * @remarks
 * The pinned controls sit in a box that takes the room the rest of the bar leaves (the sidebar's button, View, the
 * panel, Compare): that box's width is their room. Each pinned control's width is measured while it is drawn and
 * remembered, so one moved out can be brought back when there is room for it again; a control pinned while the bar is
 * narrow is drawn once, measured, then moved out if it does not fit.
 *
 * @module
 */
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/**
 * The ids of the pinned controls that do not fit, in their order: those from the first that passes the room on.
 *
 * @param pinned - the pinned controls' ids, in their order.
 * @param widths - each one's measured width, in CSS px.
 * @param room - the room they have, in CSS px.
 * @param gap - the gap between two of them, in CSS px.
 */
export const overflowing = (
  pinned: readonly string[],
  widths: ReadonlyMap<string, number>,
  room: number,
  gap: number
): string[] => {
  let used = 0;
  const first = pinned.findIndex((id, index) => {
    used += (widths.get(id) ?? 0) + (index > 0 ? gap : 0);
    return used > room;
  });
  return first === -1 ? [] : pinned.slice(first);
};

/**
 * The pinned controls the bar has no room for.
 *
 * @param box - the box the pinned controls sit in.
 * @param pinned - the pinned controls' ids, in their order.
 * @returns the ids of those moved into the View menu.
 */
export const useToolbarOverflow = (
  box: RefObject<HTMLElement | null>,
  pinned: readonly string[]
): string[] => {
  const widths = useRef(new Map<string, number>());
  const [moved, setMoved] = useState<string[]>([]);
  const key = pinned.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again whenever the pinned controls change
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    const measure = (): void => {
      for (const child of element.children) {
        if (child instanceof HTMLElement)
          widths.current.set(child.dataset["control"] ?? "", child.offsetWidth);
      }
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      const next = overflowing(pinned, widths.current, element.clientWidth, gap);
      setMoved((current) => (current.join(",") === next.join(",") ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return (): void => observer.disconnect();
  }, [key]);
  return moved.filter((id) => pinned.includes(id));
};
