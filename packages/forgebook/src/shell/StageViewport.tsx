/**
 * The room a story's frame gets on the stage, as a browser's device mode: the stage's whole width or a fixed one,
 * centred, with a handle on each side; the width it has is reported to the toolbar's field. On a story's page a
 * handle at its foot sets its height too: the story's own (its content, at least the height it declares) or a dragged one, which is the window the story's overlays are placed in.
 *
 * @remarks
 * Dragging either handle widens or narrows the story on both sides at once, so it stays centred; a double click on a
 * handle gives the story the whole stage again. A handle keeps the pointer while it drags, so the frame under it
 * cannot take the moves; the arrow keys move it too (10 px, 50 px with Shift). The width reaches the address only when
 * a drag ends or the toolbar's field is committed, so a drag is one entry in the address, not hundreds. A story wider than the
 * stage scrolls sideways. The foot handle works the same way downwards (one side, so the height follows the pointer
 * one for one), its arrow keys are up and down, and a double click gives the story its own height back.
 *
 * @module
 */
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";

import {
  clampedHeight,
  clampedWidth,
  STAGE_HEIGHT_RANGE,
  type StageHeight,
  type StageWidth,
  type Zoom
} from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { STRINGS } from "./strings.ts";

/** The viewport's props. */
export type StageViewportProps = {
  /** The story's width. */
  readonly width: StageWidth;
  /** Called with the width a handle, the keyboard or the field set; none shows no handles (the component's page). */
  readonly onWidthChange?: ((width: StageWidth) => void) | undefined;
  /** The story's zoom, in percent: it scales the drawing, the story keeps its width. */
  readonly zoom?: Zoom;
  /** Called with the width the story really has (a drag's, or the stage's while it fills it), for the toolbar. */
  readonly onShownWidthChange?: ((width: number | undefined) => void) | undefined;
  /** The colour the story's page has (its source's, for the view), which the room waits on; the surface's otherwise. */
  readonly background?: string | undefined;
  /** The story's height: its own by default. */
  readonly height?: StageHeight;
  /** Called with the height the foot handle or its keys set; none shows no foot handle (the component's page). */
  readonly onHeightChange?: ((height: StageHeight) => void) | undefined;
  /**
   * Whether the room holds a device (`DeviceSlot.tsx`): the device is the story's edge, so the room draws no surface
   * of its own; `false` by default.
   */
  readonly isDevice?: boolean;
  /**
   * The frame, or a function that draws it at the height set by the foot handle (a drag's while it lasts), in the
   * story's own CSS px; `undefined` lets the frame take the story's own.
   */
  readonly children: ReactNode | ((height: number | undefined) => ReactNode);
};

/** A handle's width, in CSS px: the stage's `$space-4`. */
const HANDLE_WIDTH = 16;

/** How much one arrow key changes the width, in CSS px: without and with Shift. */
const KEY_STEP = { normal: 10, large: 50 } as const;

/** Which side a handle is on: dragging the start one leftwards widens the story, the end one rightwards. */
type Side = "start" | "end";

/** A height, as the foot handle's readout writes it. */
const heightLabel = (height: number): string => `${height} px`;

/** The height set on the stage, in CSS px; none at the story's own. */
const chosenHeightOf = (height: StageHeight): number | undefined => (height === "auto" ? undefined : height);

/** The column of the story and its foot handle: the canvas's room for Fill, its content's otherwise. */
const columnStyle = (layoutWidth: number | undefined): CSSProperties | undefined =>
  layoutWidth === undefined ? { flex: 1, minWidth: 0 } : undefined;

/** The frame, drawn at the height set on the stage when it is drawn by a function. */
const drawnFrame = (children: StageViewportProps["children"], height: number | undefined): ReactNode =>
  typeof children === "function" ? children(height) : children;

/** The foot handle's props. */
type FootHandleProps = {
  /** The story's zoom, as a factor: a move of the pointer is a smaller or larger move in the story's own px. */
  readonly scale: number;
  /** The height of the story's room as measured, for the separator's value at the story's own height. */
  readonly roomHeight: number | undefined;
  /** The height set, a drag's while it lasts; none at the story's own. */
  readonly fixedHeight: number | undefined;
  /** The story's height now, in its own px: where a drag or a key starts from. */
  readonly currentHeight: () => number;
  /** Called with the height while a drag lasts, then with none. */
  readonly onDrag: (height: number | undefined) => void;
  /** Called with the height a drag, a key or a double click set; none draws no handle. */
  readonly onHeightChange: ((height: StageHeight) => void) | undefined;
};

/**
 * The handle at the story's foot: a drag or the up and down keys set the story's height from the one it
 * has, a double click gives it its own back; it shows the height set.
 *
 * @param props - the zoom, the heights and their setters.
 */
const FootHandle = ({
  scale,
  roomHeight,
  fixedHeight,
  currentHeight,
  onDrag,
  onHeightChange
}: FootHandleProps): ReactNode => {
  if (onHeightChange === undefined) return null;
  const startDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    // from the height the story has now: its own (at least the declared one) or the one set before
    const startHeight = currentHeight();
    const heightAt = (clientY: number): number => clampedHeight(startHeight + (clientY - startY) / scale);
    const move = (moveEvent: globalThis.PointerEvent): void => onDrag(heightAt(moveEvent.clientY));
    const end = (endEvent: globalThis.PointerEvent): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      onDrag(undefined);
      if (endEvent.clientY !== startY) onHeightChange(heightAt(endEvent.clientY));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const resizeWithKeys = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? KEY_STEP.large : KEY_STEP.normal;
    if (event.key === "ArrowDown") onHeightChange(clampedHeight(currentHeight() + step));
    else if (event.key === "ArrowUp") onHeightChange(clampedHeight(currentHeight() - step));
    else return;
    event.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable splitter has no element of its own; role separator with a value is the ARIA pattern for it
    <div
      className="forgebook-viewport__foot"
      role="separator"
      aria-orientation="horizontal"
      aria-label={STRINGS.heightHandle}
      aria-valuemin={STAGE_HEIGHT_RANGE.min}
      aria-valuemax={STAGE_HEIGHT_RANGE.max}
      aria-valuenow={fixedHeight ?? roomHeight}
      title={STRINGS.heightHandleHint}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={resizeWithKeys}
      onDoubleClick={(): void => onHeightChange("auto")}
    >
      {/* a set height says so: the story is not at its own */}
      {fixedHeight === undefined ? null : (
        <span className="forgebook-viewport__foot-label">{heightLabel(fixedHeight)}</span>
      )}
    </div>
  );
};

/**
 * The room of a story's frame.
 *
 * @param props - the width, its setter and the frame.
 */
export const StageViewport = ({
  width,
  onWidthChange,
  zoom = 100,
  onShownWidthChange,
  background,
  height = "auto",
  onHeightChange,
  isDevice = false,
  children
}: StageViewportProps): ReactNode => {
  const { widthRange } = useCatalogue();
  const roomRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scale = zoom / 100;
  // the room the story gets for "fill", in the story's own px: the canvas's width, unzoomed
  const [canvasWidth, setCanvasWidth] = useState<number | undefined>(undefined);
  // the story's height in its own px, for the zoomed box around it
  const [roomHeight, setRoomHeight] = useState<number | undefined>(undefined);
  // the width while a drag is under way; the address gets it when the drag ends
  const [dragWidth, setDragWidth] = useState<number | undefined>(undefined);
  // the width the story really has: the stage's own for "fill"
  const [shownWidth, setShownWidth] = useState<number | undefined>(undefined);
  // the height while the foot handle drags; the address gets it when the drag ends
  const [dragHeight, setDragHeight] = useState<number | undefined>(undefined);

  // offsetWidth and offsetHeight are the story's own px: a zoom's transform does not change them
  useEffect(() => {
    const room = roomRef.current;
    const canvas = canvasRef.current;
    if (room === null || canvas === null) return;
    const observer = new ResizeObserver(() => {
      setShownWidth(room.offsetWidth);
      setRoomHeight(room.offsetHeight);
      setCanvasWidth(canvas.clientWidth);
    });
    observer.observe(room);
    observer.observe(canvas);
    return (): void => observer.disconnect();
  }, []);

  // the toolbar's width field shows the width the story has, a drag's included; none once the stage goes
  const reportedWidth = dragWidth ?? shownWidth;
  useEffect(() => onShownWidthChange?.(reportedWidth), [onShownWidthChange, reportedWidth]);
  useEffect(() => (): void => onShownWidthChange?.(undefined), [onShownWidthChange]);

  const currentWidth = (): number => roomRef.current?.offsetWidth ?? widthRange.min;

  const startDrag = (side: Side, event: PointerEvent<HTMLDivElement>): void => {
    if (onWidthChange === undefined || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = currentWidth();
    // centred: a handle moved by x changes the width by twice x, in the story's own px
    const widthAt = (clientX: number): number =>
      clampedWidth(
        startWidth + (2 * (side === "end" ? clientX - startX : startX - clientX)) / scale,
        widthRange
      );
    const move = (moveEvent: globalThis.PointerEvent): void => setDragWidth(widthAt(moveEvent.clientX));
    const end = (endEvent: globalThis.PointerEvent): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setDragWidth(undefined);
      if (endEvent.clientX !== startX) onWidthChange(widthAt(endEvent.clientX));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const resizeWithKeys = (side: Side, event: KeyboardEvent<HTMLDivElement>): void => {
    if (onWidthChange === undefined) return;
    const step = event.shiftKey ? KEY_STEP.large : KEY_STEP.normal;
    const outward = side === "end" ? "ArrowRight" : "ArrowLeft";
    const inward = side === "end" ? "ArrowLeft" : "ArrowRight";
    if (event.key === outward) onWidthChange(clampedWidth(currentWidth() + step, widthRange));
    else if (event.key === inward) onWidthChange(clampedWidth(currentWidth() - step, widthRange));
    else return;
    event.preventDefault();
  };

  const fixedHeight = dragHeight ?? chosenHeightOf(height);
  const fixedWidth = dragWidth ?? (width === "fill" ? undefined : width);
  // "fill" takes the canvas, less the two handles, in the story's own px
  const handlesWidth = onWidthChange === undefined ? 0 : 2 * HANDLE_WIDTH;
  const layoutWidth =
    fixedWidth ?? (canvasWidth === undefined ? undefined : Math.max(0, canvasWidth - handlesWidth) / scale);
  const handle = (side: Side): ReactNode =>
    onWidthChange === undefined ? null : (
      // biome-ignore lint/a11y/useSemanticElements: a draggable splitter has no element of its own; role separator with a value is the ARIA pattern for it
      <div
        className="forgebook-viewport__handle"
        data-side={side}
        role="separator"
        aria-orientation="vertical"
        aria-label={STRINGS.widthHandle}
        aria-valuemin={widthRange.min}
        aria-valuemax={widthRange.max}
        aria-valuenow={dragWidth ?? shownWidth}
        title={STRINGS.widthHandleHint}
        tabIndex={0}
        onPointerDown={(event: PointerEvent<HTMLDivElement>): void => startDrag(side, event)}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>): void => resizeWithKeys(side, event)}
        onDoubleClick={(): void => onWidthChange("fill")}
      />
    );

  const currentHeight = (): number => roomRef.current?.offsetHeight ?? STAGE_HEIGHT_RANGE.min;
  const isDragging = [dragWidth, dragHeight].some((dragged) => dragged !== undefined);
  return (
    <div className="forgebook-viewport">
      <div ref={canvasRef} className="forgebook-viewport__canvas">
        {handle("start")}
        <div className="forgebook-viewport__column" style={columnStyle(layoutWidth)}>
          {/* the zoomed box takes the room the scaled story shows; the story inside keeps its own width */}
          <div
            className="forgebook-viewport__zoom"
            style={
              layoutWidth === undefined
                ? undefined
                : {
                    width: layoutWidth * scale,
                    height: roomHeight === undefined ? undefined : roomHeight * scale
                  }
            }
          >
            <div
              ref={roomRef}
              className="forgebook-viewport__room"
              data-dragging={isDragging ? "" : undefined}
              data-device={isDevice ? "" : undefined}
              style={{
                width: layoutWidth,
                transform: scale === 1 ? undefined : `scale(${scale})`,
                backgroundColor: background
              }}
            >
              {drawnFrame(children, fixedHeight)}
            </div>
          </div>
          <FootHandle
            scale={scale}
            roomHeight={roomHeight}
            fixedHeight={fixedHeight}
            currentHeight={currentHeight}
            onDrag={setDragHeight}
            onHeightChange={onHeightChange}
          />
        </div>
        {handle("end")}
      </div>
    </div>
  );
};
