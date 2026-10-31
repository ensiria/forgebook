/**
 * A small info button whose note shows while the pointer is over it or it has the focus: for a control that needs a
 * word of warning (the touch simulation's limits) without a paragraph under it.
 *
 * @remarks
 * The note is a manual popover in the top layer, placed under the button (above it near the window's foot), so no
 * scrolling menu or toolbar clips it; it is the button's description for screen readers as well, and Escape hides it.
 *
 * @module
 */
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";

/** The room kept between the note, its button and the window's edges, in CSS px. */
const GAP_PX = 6;

/**
 * The info button.
 *
 * @param props - the note, and the name of what it is about.
 */
export const InfoTip = ({
  note,
  about
}: {
  /** The note. */
  readonly note: string;
  /** What it is about, for the button's name (`Touch`). */
  readonly about: string;
}): ReactNode => {
  const noteId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const show = (): void => {
    const button = buttonRef.current;
    const tip = noteRef.current;
    if (button === null || tip === null || tip.matches(":popover-open")) return;
    tip.showPopover();
    const box = button.getBoundingClientRect();
    const height = tip.offsetHeight;
    const isAbove = box.bottom + GAP_PX + height > window.innerHeight;
    const left = Math.min(Math.max(GAP_PX, box.left), window.innerWidth - tip.offsetWidth - GAP_PX);
    tip.style.left = `${left}px`;
    tip.style.top = `${isAbove ? box.top - GAP_PX - height : box.bottom + GAP_PX}px`;
  };
  const hide = (): void => {
    if (noteRef.current?.matches(":popover-open") === true) noteRef.current.hidePopover();
  };
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="forgebook-info-tip"
        aria-label={STRINGS.aboutControl(about)}
        aria-describedby={noteId}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
          // an open note takes the first Escape; the menu around it, the next
          if (event.key !== "Escape" || noteRef.current?.matches(":popover-open") !== true) return;
          event.stopPropagation();
          hide();
        }}
      >
        <Icon name="info" size={14} />
      </button>
      <span ref={noteRef} id={noteId} className="forgebook-info-tip__note" popover="manual" role="tooltip">
        {note}
      </span>
    </>
  );
};
