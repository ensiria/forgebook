/**
 * A surface for the catalogue's touch tests: it lists the events it receives, has a part that changes on hover (and
 * says so under a phone's media), a list that scrolls and a part that keeps every move for itself.
 *
 * @module
 */
import "./touchPad.scss";

import { type ReactNode, type SyntheticEvent, useState } from "react";

/** The touch pad's props. */
export type TouchPadProps = {
  /** The pad's label. */
  readonly label: string;
};

/** The scrolling list's rows. */
const ROWS: readonly string[] = Array.from({ length: 30 }, (_, index) => `Row ${index + 1}`);

/** How many events the log keeps. */
const LOG_LENGTH = 12;

/**
 * Lists what it receives.
 *
 * @param props - the touch pad's props.
 */
export const TouchPad = ({ label }: TouchPadProps): ReactNode => {
  // each entry numbered, so a repeated event keeps its own key
  const [log, setLog] = useState<readonly { readonly id: number; readonly text: string }[]>([]);
  const note = (event: SyntheticEvent): void => {
    const native = event.nativeEvent;
    const kind = native instanceof PointerEvent ? ` ${native.pointerType}` : "";
    const touches =
      typeof TouchEvent === "function" && native instanceof TouchEvent ? ` ${native.touches.length}` : "";
    setLog((current) =>
      [...current, { id: (current.at(-1)?.id ?? 0) + 1, text: `${event.type}${kind}${touches}` }].slice(
        -LOG_LENGTH
      )
    );
  };
  return (
    <div className="touch-pad">
      <button
        type="button"
        className="touch-pad__target"
        onPointerDown={note}
        onPointerUp={note}
        onPointerCancel={note}
        onTouchStart={note}
        onTouchEnd={note}
        onClick={note}
        onContextMenu={(event): void => {
          event.preventDefault();
          note(event);
        }}
      >
        {label}
      </button>
      <span className="touch-pad__hover">Hover me</span>
      <span className="touch-pad__phone">A phone's media</span>
      <ul className="touch-pad__list" aria-label="Scrolling list">
        {ROWS.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <div
        className="touch-pad__drawing"
        role="img"
        aria-label="Drawing area"
        onTouchStart={note}
        onPointerMove={(event): void => {
          if (event.buttons > 0) note(event);
        }}
      />
      <ol className="touch-pad__log" aria-label="Events">
        {log.map((entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ol>
    </div>
  );
};
