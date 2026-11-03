/**
 * The device's parts the shell loads the first time a story is shown in a device (`DeviceSlot.tsx`): the drawing of a
 * model, its layers under and over the story, and their styles.
 *
 * @remarks
 * One chunk, imported on first use, so a catalogue that never shows a device never fetches the models, their drawing
 * or their styles. The hardware takes the shell's appearance, read from the root's attribute the shell's palettes
 * read, and the status bar the story's scheme. The drawing is the one `forgebook shot` frames its pictures with
 * (`deviceDrawing.ts`).
 *
 * @module
 */
import "./deviceFrame.scss";

import { type CSSProperties, type ReactNode, useSyncExternalStore } from "react";

import {
  DEVICE_FONT,
  DEVICE_INK,
  DEVICE_PAINTS,
  type DevicePaint,
  type DeviceShape,
  deviceDrawing
} from "../../deviceDrawing.ts";
import { deviceModel, type StoryArea, storyArea } from "../../devices.ts";
import type { ShownDevice } from "../../deviceView.ts";
import { withSafeArea } from "../../safeAreaParameter.ts";
import { APPEARANCE_ATTRIBUTE } from "../useAppearance.ts";

/**
 * A device's drawing, held as shown.
 *
 * @param shown - the device and how it is held.
 */
export const drawingOf = (shown: ShownDevice): ReturnType<typeof deviceDrawing> =>
  deviceDrawing(deviceModel(shown.model), shown.orientation);

/**
 * The part of a device's screen a story is drawn in.
 *
 * @param shown - the device and how it is held.
 * @param isEdgeToEdge - whether the story draws edge to edge.
 */
export const areaOf = (shown: ShownDevice, isEdgeToEdge: boolean): StoryArea =>
  storyArea(deviceModel(shown.model), shown.orientation, isEdgeToEdge);

/**
 * A story frame's address in its device: told the safe areas when it draws edge to edge, as it is otherwise.
 *
 * @param address - the frame's address.
 * @param area - the story's area.
 */
export const addressIn = (address: string, area: StoryArea): string =>
  Object.values(area.safeArea).some((inset) => inset > 0) ? withSafeArea(address, area.safeArea) : address;

/** Calls back when the shell's appearance changes on the root. */
const subscribeAppearance = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [APPEARANCE_ATTRIBUTE] });
  return (): void => observer.disconnect();
};

/** Whether the shell draws in its dark palette now. */
const isShellDark = (): boolean => document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE) === "dark";

/** Whether the shell draws in its dark palette, kept in step with the root's attribute. */
const useShellDark = (): boolean => useSyncExternalStore(subscribeAppearance, isShellDark, () => false);

/**
 * One shape as an SVG element.
 *
 * @param shape - the shape.
 * @param index - its place in its layer, its key.
 * @param paint - the colour of each paint.
 */
const shapeElement = (shape: DeviceShape, index: number, paint: (name: DevicePaint) => string): ReactNode => {
  if (shape.kind === "rect")
    return (
      <rect
        key={index}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={shape.radius}
        fill={shape.fill === undefined ? "none" : paint(shape.fill)}
        stroke={shape.stroke === undefined ? undefined : paint(shape.stroke)}
        // the outline drawn inside the shape's edge, so the body keeps its size
        strokeWidth={shape.stroke === undefined ? undefined : 1}
        opacity={shape.opacity}
      />
    );
  if (shape.kind === "circle")
    return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={paint(shape.fill)} />;
  if (shape.kind === "path") return <path key={index} d={shape.d} fill={paint(shape.fill)} />;
  return (
    <text
      key={index}
      x={shape.x}
      y={shape.y}
      fontSize={shape.size}
      fontWeight={shape.weight}
      fontFamily={DEVICE_FONT}
      textAnchor={shape.anchor}
      dominantBaseline="central"
      fill={paint(shape.fill)}
    >
      {shape.text}
    </text>
  );
};

/** A layer's props. */
export type DeviceLayerProps = {
  /** The device's drawing. */
  readonly drawing: ReturnType<typeof deviceDrawing>;
  /** Which layer: the hardware under the story, or the camera's cut and the status bar over it. */
  readonly layer: "under" | "over";
  /** The story's scheme, which the status bar's ink follows; light by default. */
  readonly scheme?: "light" | "dark";
};

/**
 * One layer of a device: decorative, so hidden from screen readers; the one over the story never takes the pointer.
 *
 * @param props - the drawing, the layer and the story's scheme.
 */
export const DeviceLayer = ({ drawing, layer, scheme = "light" }: DeviceLayerProps): ReactNode => {
  const paints = DEVICE_PAINTS[useShellDark() ? "dark" : "light"];
  const paint = (name: DevicePaint): string => (name === "ink" ? DEVICE_INK[scheme] : paints[name]);
  return (
    <svg
      className="forgebook-device__layer"
      data-layer={layer}
      width={drawing.width}
      height={drawing.height}
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {(layer === "under" ? drawing.under : drawing.over).map((shape, index) =>
        shapeElement(shape, index, paint)
      )}
    </svg>
  );
};

/** A device around a frame, as its slot lays it out (`DeviceSlot.tsx`). */
export type DeviceFraming = {
  /** The slot's attributes: marked framed, with the model and the orientation, at the drawing's size. */
  readonly root: {
    readonly "data-framed": "";
    readonly "data-model": string;
    readonly "data-orientation": string;
    readonly style: CSSProperties;
  };
  /** The screen's place and shape in the drawing, on the story's page colour, the story inside its area. */
  readonly screen: CSSProperties;
  /** The hardware, under the screen. */
  readonly under: ReactNode;
  /** The camera's cut and the status bar, over the screen. */
  readonly over: ReactNode;
};

/**
 * A device around a frame.
 *
 * @param framed - the device shown and its drawing.
 * @param scheme - the story's scheme, which the status bar's ink follows.
 * @param background - the story's page colour.
 */
export const deviceFraming = (
  framed: {
    readonly shown: ShownDevice;
    readonly drawing: ReturnType<typeof deviceDrawing>;
    readonly area: StoryArea;
  },
  scheme: "light" | "dark",
  background: string | undefined
): DeviceFraming => {
  const { drawing, shown, area } = framed;
  return {
    root: {
      "data-framed": "",
      "data-model": shown.model,
      "data-orientation": shown.orientation,
      style: { width: drawing.width, height: drawing.height }
    },
    screen: {
      left: drawing.screen.x,
      top: drawing.screen.y,
      width: drawing.screen.width,
      height: drawing.screen.height,
      borderRadius: drawing.screen.radius,
      backgroundColor: background,
      // the story inside the safe areas: the status bar, the camera's cut and the home indicator draw around it
      paddingTop: area.around.top,
      paddingRight: area.around.right,
      paddingBottom: area.around.bottom,
      paddingLeft: area.around.left
    },
    under: <DeviceLayer key="under" drawing={drawing} layer="under" />,
    over: <DeviceLayer key="over" drawing={drawing} layer="over" scheme={scheme} />
  };
};

/**
 * The compare view's grid with a device in each cell: as many cells side by side as devices fit, marked for the
 * device's styles.
 *
 * @param drawing - the device's drawing.
 */
export const compareGridProps = (
  drawing: ReturnType<typeof deviceDrawing>
): { readonly "data-device": ""; readonly style: CSSProperties } => ({
  "data-device": "",
  style: { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${drawing.width + 32}px), 1fr))` }
});
