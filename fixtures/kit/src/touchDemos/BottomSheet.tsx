/**
 * A bottom sheet over a map-like page: a finger drags its handle between three heights (a peek, half, nearly full),
 * and a quick flick carries it to the next; a tap or a click on the handle steps through them.
 *
 * @module
 */
import "./touchDemos.scss";

import { type PointerEvent, type ReactNode, useRef, useState } from "react";

/** The heights the sheet rests at, as parts of its room. */
const STOPS = [0.18, 0.5, 0.88] as const;

/** A flick faster than this, in CSS px per ms, goes to the next height. */
const FLICK = 0.5;

/** Invented places listed in the sheet. */
const PLACES: readonly string[] = [
  "Caffè Centrale · 120 m",
  "Libreria del Porto · 300 m",
  "Mercato coperto · 450 m",
  "Giardini pubblici · 600 m",
  "Museo civico · 800 m",
  "Stazione · 1.1 km",
  "Faro · 2.4 km"
];

/** A drag of the handle under way. */
type SheetDrag = {
  /** Where the finger went down, up and down. */
  readonly startY: number;
  /** The sheet's height then, as a part of its room. */
  readonly base: number;
  /** The finger's last place and time, for the flick's speed. */
  last: { readonly y: number; readonly time: number };
  /** The finger's speed, in CSS px per ms (down is positive). */
  speed: number;
};

/** The sheet's props. */
export type BottomSheetProps = {
  /** The sheet's heading. */
  readonly title: string;
};

/**
 * A bottom sheet with a draggable handle.
 *
 * @param props - the sheet's props.
 */
export const BottomSheet = ({ title }: BottomSheetProps): ReactNode => {
  const roomRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(STOPS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<SheetDrag | undefined>(undefined);
  // a drag ends with the press's click: only a press that did not move steps the sheet
  const hasMoved = useRef(false);
  const room = (): number => roomRef.current?.clientHeight ?? 1;
  const down = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startY: event.clientY,
      base: height,
      last: { y: event.clientY, time: event.timeStamp },
      speed: 0
    };
    hasMoved.current = false;
    setIsDragging(true);
  };
  const move = (event: PointerEvent<HTMLButtonElement>): void => {
    const current = drag.current;
    if (current === undefined) return;
    const ms = Math.max(1, event.timeStamp - current.last.time);
    current.speed = (event.clientY - current.last.y) / ms;
    current.last = { y: event.clientY, time: event.timeStamp };
    if (Math.abs(event.clientY - current.startY) > 4) hasMoved.current = true;
    setHeight(Math.max(0.1, Math.min(0.95, current.base - (event.clientY - current.startY) / room())));
  };
  const up = (): void => {
    const current = drag.current;
    if (current === undefined) return;
    drag.current = undefined;
    setIsDragging(false);
    const nearest = STOPS.reduce((best, stop) =>
      Math.abs(stop - height) < Math.abs(best - height) ? stop : best
    );
    const index = STOPS.indexOf(nearest);
    if (current.speed < -FLICK) setHeight(STOPS[Math.min(STOPS.length - 1, index + 1)] ?? nearest);
    else if (current.speed > FLICK) setHeight(STOPS[Math.max(0, index - 1)] ?? nearest);
    else setHeight(nearest);
  };
  const step = (): void => {
    const index = STOPS.findIndex((stop) => Math.abs(stop - height) < 0.01);
    setHeight(STOPS[(index + 1) % STOPS.length] ?? STOPS[0]);
  };
  return (
    <section ref={roomRef} className="touch-demo bottom-sheet">
      <div className="bottom-sheet__map" aria-hidden="true">
        <span className="bottom-sheet__pin">●</span>
      </div>
      <div
        className="bottom-sheet__sheet"
        data-dragging={isDragging ? "" : undefined}
        style={{ height: `${height * 100}%` }}
      >
        <button
          type="button"
          className="bottom-sheet__handle"
          aria-label="Resize the sheet"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onClick={(): void => {
            if (!hasMoved.current) step();
            hasMoved.current = false;
          }}
        >
          <span />
        </button>
        <h3>{title}</h3>
        <ul className="bottom-sheet__list">
          {PLACES.map((place) => (
            <li key={place}>{place}</li>
          ))}
        </ul>
      </div>
    </section>
  );
};
