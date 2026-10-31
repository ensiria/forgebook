/**
 * A photo to zoom and turn: one finger pans it, two fingers (Shift in the catalogue) pinch and rotate it, a double tap
 * zooms in and back; with a mouse, the wheel zooms and a drag pans. Every move is the component's own
 * (`touch-action: none`).
 *
 * @module
 */
import "./touchDemos.scss";

import { type PointerEvent, type ReactNode, useRef, useState, type WheelEvent } from "react";

/** Where the photo is: its offset, its scale and its turn. */
type Placement = {
  /** Its offset sideways, in CSS px. */
  readonly x: number;
  /** Its offset up and down, in CSS px. */
  readonly y: number;
  /** Its scale. */
  readonly scale: number;
  /** Its turn, in degrees. */
  readonly angle: number;
};

/** The photo as it starts. */
const AT_REST: Placement = { x: 0, y: 0, scale: 1, angle: 0 };

/** Two taps closer than this, in ms, are a double tap. */
const DOUBLE_TAP_MS = 300;

/** A point. */
type Point = {
  /** Sideways, in CSS px. */
  readonly x: number;
  /** Up and down, in CSS px. */
  readonly y: number;
};

/** The distance and the angle between two points. */
const spanOf = (first: Point, second: Point): { readonly distance: number; readonly angle: number } => ({
  distance: Math.hypot(second.x - first.x, second.y - first.y),
  angle: (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI
});

/**
 * The turn from one angle to another, the short way round: between -180° and 180°, so crossing the left of the
 * circle does not spin the photo all the way.
 *
 * @param from - the first angle, in degrees.
 * @param to - the second.
 */
const turnOf = (from: number, to: number): number => ((((to - from + 180) % 360) + 360) % 360) - 180;

/** The photo viewer's props. */
export type PhotoViewerProps = {
  /** The photo's caption. */
  readonly caption: string;
};

/**
 * A photo to pinch, turn and pan.
 *
 * @param props - the viewer's props.
 */
export const PhotoViewer = ({ caption }: PhotoViewerProps): ReactNode => {
  const [placement, setPlacement] = useState<Placement>(AT_REST);
  const [isMoving, setIsMoving] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const start = useRef<{ placement: Placement; points: Point[] } | undefined>(undefined);
  const lastTap = useRef(0);
  // a gesture starts again each time a finger joins or leaves, from where the photo is
  const restart = (): void => {
    start.current = { placement, points: [...pointers.current.values()] };
  };
  const down = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsMoving(true);
    restart();
    if (event.pointerType !== "mouse" && pointers.current.size === 1) {
      const now = event.timeStamp;
      if (now - lastTap.current < DOUBLE_TAP_MS)
        setPlacement(placement.scale > 1 ? AT_REST : { ...placement, scale: 2.5 });
      lastTap.current = now;
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.has(event.pointerId) || start.current === undefined) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = [...pointers.current.values()];
    const from = start.current;
    const [a, b] = from.points;
    const [c, d] = now;
    if (a === undefined || c === undefined) return;
    if (b !== undefined && d !== undefined) {
      const before = spanOf(a, b);
      const after = spanOf(c, d);
      const shift = { x: (c.x + d.x - a.x - b.x) / 2, y: (c.y + d.y - a.y - b.y) / 2 };
      setPlacement({
        x: from.placement.x + shift.x,
        y: from.placement.y + shift.y,
        scale: Math.max(
          0.5,
          Math.min(6, (from.placement.scale * after.distance) / Math.max(1, before.distance))
        ),
        angle: from.placement.angle + turnOf(before.angle, after.angle)
      });
    } else
      setPlacement({ ...from.placement, x: from.placement.x + c.x - a.x, y: from.placement.y + c.y - a.y });
  };
  const up = (event: PointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setIsMoving(false);
    restart();
  };
  const wheel = (event: WheelEvent<HTMLDivElement>): void =>
    setPlacement((current) => ({
      ...current,
      scale: Math.max(0.5, Math.min(6, current.scale * (event.deltaY < 0 ? 1.1 : 0.9)))
    }));
  return (
    <section className="touch-demo photo-viewer">
      <div
        className="photo-viewer__stage"
        role="img"
        aria-label={caption}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
      >
        <div
          className="photo-viewer__photo"
          data-moving={isMoving ? "" : undefined}
          style={{
            transform: `translate(${placement.x}px, ${placement.y}px) rotate(${placement.angle}deg) scale(${placement.scale})`
          }}
        >
          <span>{caption}</span>
        </div>
      </div>
      <footer className="photo-viewer__readout">
        <span>
          {Math.round(placement.scale * 100)}% · {Math.round(placement.angle)}°
        </span>
        <button type="button" className="touch-demo__reset" onClick={(): void => setPlacement(AT_REST)}>
          Reset
        </button>
      </footer>
    </section>
  );
};
