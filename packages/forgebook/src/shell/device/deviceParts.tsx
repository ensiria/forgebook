/**
 * The device's parts the shell loads the first time a story is shown in a device (`DeviceSlot.tsx`): the drawing of a
 * model, its layers under and over the story, the toolbar's menu of models, and their styles.
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

import { type ChangeEvent, type CSSProperties, type ReactNode, useSyncExternalStore } from "react";

import {
  DEVICE_FONT,
  DEVICE_INK,
  DEVICE_PAINTS,
  type DevicePaint,
  type DeviceShape,
  deviceDrawing
} from "../../deviceDrawing.ts";
import { withModel, withTurn } from "../../deviceMenuView.ts";
import { DEVICE_MODELS, type DeviceKind, deviceModel } from "../../devices.ts";
import { type DeviceDefault, type DeviceView, isDeviceId, type ShownDevice } from "../../deviceView.ts";
import { STRINGS } from "../strings.ts";
import { APPEARANCE_ATTRIBUTE } from "../useAppearance.ts";

/**
 * A device's drawing, held as shown.
 *
 * @param shown - the device and how it is held.
 */
export const drawingOf = (shown: ShownDevice): ReturnType<typeof deviceDrawing> =>
  deviceDrawing(deviceModel(shown.model), shown.orientation);

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

/** The device menu's props. */
export type DeviceMenuProps<View extends DeviceView> = {
  /** The view. */
  readonly view: View;
  /** Called with the changed view. */
  readonly onViewChange: (view: View) => void;
  /** The page's default device: a story's, or the catalogue's. */
  readonly defaults: DeviceDefault;
  /** The device shown. */
  readonly shown: ShownDevice;
};

/** The turn button's icon, drawn as the shell's icons are: a phone on its side and an arrow turning it. */
const TurnIcon = (): ReactNode => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2.5 9.5h7a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1ZM12 12.5a2.5 2.5 0 0 0 2.5-2.5V8.5M13.5 10l1-1.5 1 1.5" />
  </svg>
);

/** The groups of the model list, in its order. */
const KIND_GROUPS: readonly { readonly kind: DeviceKind; readonly label: () => string }[] = [
  { kind: "phone", label: () => STRINGS.devicePhones },
  { kind: "tablet", label: () => STRINGS.deviceTablets }
];

/**
 * The model shown, as a native list (the platform's keys and screen reader), and the button that turns the device.
 *
 * @param props - the view, its setter, the default and the device shown.
 */
export const DeviceMenu = <View extends DeviceView>({
  view,
  onViewChange,
  defaults,
  shown
}: DeviceMenuProps<View>): ReactNode => (
  <>
    <select
      className="forgebook-select forgebook-device-menu__model"
      aria-label={STRINGS.deviceModel}
      value={shown.model}
      onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
        const model = event.currentTarget.value;
        if (isDeviceId(model)) onViewChange(withModel(view, defaults, model));
      }}
    >
      {KIND_GROUPS.map((group) => (
        <optgroup key={group.kind} label={group.label()}>
          {DEVICE_MODELS.filter((model) => model.kind === group.kind).map((model) => (
            <option key={model.id} value={model.id}>
              {model.id === "phone" ? STRINGS.deviceGeneric : model.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
    <button
      type="button"
      className="forgebook-button forgebook-button--icon"
      title={STRINGS.deviceTurn}
      aria-label={STRINGS.deviceTurn}
      aria-pressed={shown.orientation === "landscape"}
      onClick={(): void => onViewChange(withTurn(view, defaults, shown))}
    >
      <TurnIcon />
    </button>
  </>
);

/** A device around a frame, as its slot lays it out (`DeviceSlot.tsx`). */
export type DeviceFraming = {
  /** The slot's attributes: marked framed, with the model and the orientation, at the drawing's size. */
  readonly root: {
    readonly "data-framed": "";
    readonly "data-model": string;
    readonly "data-orientation": string;
    readonly style: CSSProperties;
  };
  /** The screen's place and shape in the drawing, on the story's page colour while it loads. */
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
  framed: { readonly shown: ShownDevice; readonly drawing: ReturnType<typeof deviceDrawing> },
  scheme: "light" | "dark",
  background: string | undefined
): DeviceFraming => {
  const { drawing, shown } = framed;
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
      backgroundColor: background
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
