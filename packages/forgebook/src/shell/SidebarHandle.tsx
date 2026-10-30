/**
 * The handle on the sidebar's right edge: dragged, or moved with the arrow keys, it sets the sidebar's width.
 *
 * @module
 */
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import { STRINGS } from "./strings.ts";

/** The sidebar's width, in CSS px: the default, the bounds, and one arrow key's step. */
export const SIDEBAR_WIDTH = { initial: 248, min: 192, max: 448, step: 16 } as const;

/**
 * A width kept between the sidebar's bounds, in whole pixels.
 *
 * @param width - a width in CSS px.
 */
export const boundedSidebarWidth = (width: number): number =>
  Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)));

/**
 * The sidebar's handle.
 *
 * @param props - the width and its setter.
 */
export const SidebarHandle = ({
  width,
  onWidthChange
}: {
  readonly width: number;
  readonly onWidthChange: (width: number) => void;
}): ReactNode => {
  const startResize = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const move = (moveEvent: globalThis.PointerEvent): void =>
      onWidthChange(boundedSidebarWidth(startWidth + moveEvent.clientX - startX));
    const end = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };
  const resizeWithKeys = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowRight") onWidthChange(boundedSidebarWidth(width + SIDEBAR_WIDTH.step));
    else if (event.key === "ArrowLeft") onWidthChange(boundedSidebarWidth(width - SIDEBAR_WIDTH.step));
    else return;
    event.preventDefault();
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable splitter has no element of its own; role separator with a value is the ARIA pattern for it
    <div
      className="forgebook-sidebar-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={STRINGS.sidebarWidth}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      tabIndex={0}
      onPointerDown={startResize}
      onKeyDown={resizeWithKeys}
    />
  );
};
