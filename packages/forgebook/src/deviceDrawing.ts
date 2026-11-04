/**
 * A device's drawing: the hardware around the screen (its band, its bezel, its buttons) and what sits over the story
 * (the camera's cut, the status bar, the home indicator), as shapes in CSS px, for the shell's frame and for
 * `forgebook shot`'s framed pictures to draw the same device.
 *
 * @remarks
 * Shapes and not markup, so each side draws them its own way (React elements in the shell, an SVG text in the
 * pictures) from one geometry. The hardware is laid out upright and turned with its top to the left for landscape,
 * as a phone is turned; the status bar is laid out for the screen as held, since a system lays it out again when
 * the phone turns (an iPhone on its side shows none). The paints are named, not coloured: the frame takes the
 * shell's appearance, the status bar's ink the story's scheme, as a phone's status bar follows the app under it.
 * Pure.
 *
 * @module
 */
import type { DeviceOrientation } from "@forgebook/story-format/csf";

import { type DeviceModel, deviceScreen } from "./devices.ts";
import type { DeviceId } from "./deviceView.ts";

/** What a shape is painted with: the hardware's band, its outline, the bezel, the camera's cut, the status bar's ink. */
export type DevicePaint = "frame" | "edge" | "bezel" | "cutout" | "ink";

/** One shape of a drawing, in CSS px. */
export type DeviceShape =
  | {
      /** A rectangle, its corners rounded. */
      readonly kind: "rect";
      /** Its left. */
      readonly x: number;
      /** Its top. */
      readonly y: number;
      /** Its width. */
      readonly width: number;
      /** Its height. */
      readonly height: number;
      /** Its corners' radius. */
      readonly radius: number;
      /** Its fill; none for an outline only. */
      readonly fill?: DevicePaint;
      /** Its outline, 1 px wide; none by default. */
      readonly stroke?: DevicePaint;
      /** Its opacity, from 0 to 1; 1 by default. */
      readonly opacity?: number;
    }
  | {
      /** A disc. */
      readonly kind: "circle";
      /** Its centre's left. */
      readonly cx: number;
      /** Its centre's top. */
      readonly cy: number;
      /** Its radius. */
      readonly r: number;
      /** Its fill. */
      readonly fill: DevicePaint;
    }
  | {
      /** A path, in SVG's path syntax. */
      readonly kind: "path";
      /** Its commands. */
      readonly d: string;
      /** Its fill. */
      readonly fill: DevicePaint;
    }
  | {
      /** A line of text, centred on its height. */
      readonly kind: "text";
      /** Where it starts, or its middle. */
      readonly x: number;
      /** Its middle's height. */
      readonly y: number;
      /** What it says. */
      readonly text: string;
      /** Its size, in CSS px. */
      readonly size: number;
      /** Its weight. */
      readonly weight: number;
      /** Whether `x` is its start or its middle. */
      readonly anchor: "start" | "middle";
      /** Its fill. */
      readonly fill: DevicePaint;
    };

/** A rectangle, its corners rounded, in CSS px. */
export type DeviceRect = {
  /** Its left. */
  readonly x: number;
  /** Its top. */
  readonly y: number;
  /** Its width. */
  readonly width: number;
  /** Its height. */
  readonly height: number;
  /** Its corners' radius. */
  readonly radius: number;
};

/** A device drawn: its size, where its screen is, and its shapes under and over the screen. */
export type DeviceDrawing = {
  /** The drawing's width, the buttons included, in CSS px. */
  readonly width: number;
  /** The drawing's height, in CSS px. */
  readonly height: number;
  /** The screen, where the story goes: its viewport's size, at its place in the drawing. */
  readonly screen: DeviceRect;
  /** Drawn under the screen: the buttons, the band and the bezel. */
  readonly under: readonly DeviceShape[];
  /** Drawn over the story, never taking the pointer: the camera's cut, the status bar, the home indicator. */
  readonly over: readonly DeviceShape[];
};

/** The paints of the hardware in each of the shell's appearances: quiet greys, a black bezel, as phones are. */
export const DEVICE_PAINTS: Readonly<
  Record<"light" | "dark", Readonly<Record<Exclude<DevicePaint, "ink">, string>>>
> = {
  light: { frame: "#d6d6db", edge: "#1d1d1f2e", bezel: "#0c0c0e", cutout: "#000" },
  dark: { frame: "#46464d", edge: "#ffffff2b", bezel: "#050506", cutout: "#000" }
};

/** The status bar's ink over a story of each scheme: dark on a light story, light on a dark one. */
export const DEVICE_INK: Readonly<Record<"light" | "dark", string>> = { light: "#000", dark: "#fff" };

/** The status bar's font: the system's, as the devices' own. */
export const DEVICE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, system-ui, sans-serif';

/** The time the status bar shows: the one phones are photographed at. */
const STATUS_TIME = "9:41";

/** How far a button stands out of the band, in CSS px: the drawing's margin on every side. */
const BUTTON_DEPTH = 3;

/** The band's and the bezel's thickness, in CSS px, by kind. */
const THICKNESS = {
  phone: { band: 4, bezel: 10 },
  tablet: { band: 4, bezel: 18 }
} as const;

/**
 * A button on the band, upright: its side, where it starts along that side and how long it is, both as a part of the
 * side's length.
 */
type Button = { readonly side: "left" | "right" | "top"; readonly at: number; readonly length: number };

/** Each model's buttons, as its maker places them. */
const BUTTONS: Readonly<Record<DeviceId, readonly Button[]>> = {
  "iphone-16": [
    { side: "left", at: 0.18, length: 0.04 },
    { side: "left", at: 0.26, length: 0.075 },
    { side: "left", at: 0.36, length: 0.075 },
    { side: "right", at: 0.29, length: 0.12 },
    { side: "right", at: 0.62, length: 0.06 }
  ],
  "iphone-16-pro-max": [
    { side: "left", at: 0.18, length: 0.04 },
    { side: "left", at: 0.26, length: 0.075 },
    { side: "left", at: 0.36, length: 0.075 },
    { side: "right", at: 0.29, length: 0.12 },
    { side: "right", at: 0.62, length: 0.06 }
  ],
  "iphone-16e": [
    { side: "left", at: 0.18, length: 0.04 },
    { side: "left", at: 0.26, length: 0.075 },
    { side: "left", at: 0.36, length: 0.075 },
    { side: "right", at: 0.29, length: 0.12 }
  ],
  "pixel-9": [
    { side: "right", at: 0.22, length: 0.07 },
    { side: "right", at: 0.32, length: 0.13 }
  ],
  "galaxy-s24": [
    { side: "right", at: 0.22, length: 0.12 },
    { side: "right", at: 0.38, length: 0.07 }
  ],
  phone: [
    { side: "right", at: 0.24, length: 0.12 },
    { side: "right", at: 0.4, length: 0.06 }
  ],
  "ipad-mini": [
    { side: "top", at: 0.8, length: 0.07 },
    { side: "right", at: 0.07, length: 0.045 },
    { side: "right", at: 0.13, length: 0.045 }
  ],
  "ipad-pro-13": [
    { side: "top", at: 0.82, length: 0.05 },
    { side: "right", at: 0.06, length: 0.035 },
    { side: "right", at: 0.105, length: 0.035 }
  ]
};

/** A length kept to two decimals: the drawings' numbers stay short and stable. */
const round = (value: number): number => Math.round(value * 100) / 100;

/** A point of the upright drawing, moved to where the drawing as held puts it. */
type PointMap = (x: number, y: number) => readonly [number, number];

/** A rectangle of the upright drawing, moved as the drawing is held: on its side, its width and height swap. */
const placedRect = (map: PointMap, isTurned: boolean, rect: DeviceRect): DeviceRect => {
  const [x, y] = isTurned ? map(rect.x + rect.width, rect.y) : map(rect.x, rect.y);
  return {
    x: round(x),
    y: round(y),
    width: round(isTurned ? rect.height : rect.width),
    height: round(isTurned ? rect.width : rect.height),
    radius: round(rect.radius)
  };
};

/** The upright size of a model's drawing, and the hardware's thickness around its screen. */
const uprightBox = (model: DeviceModel): { width: number; height: number; around: number } => {
  const { band, bezel } = THICKNESS[model.kind];
  const around = BUTTON_DEPTH + band + bezel;
  return { width: model.width + 2 * around, height: model.height + 2 * around, around };
};

/** The buttons, upright, standing out of the band. */
const buttonRects = (model: DeviceModel, body: DeviceRect): DeviceRect[] =>
  BUTTONS[model.id].map((button) => {
    const along = button.side === "top" ? body.width : body.height;
    const start = along * button.at;
    const length = along * button.length;
    if (button.side === "top")
      return { x: body.x + start, y: 0, width: length, height: BUTTON_DEPTH + 2, radius: 1 };
    return {
      x: button.side === "left" ? 0 : body.x + body.width - 2,
      y: body.y + start,
      width: BUTTON_DEPTH + 2,
      height: length,
      radius: 1
    };
  });

/**
 * The camera's cut, upright, then moved as held: a notch is a path, drawn point by point through the map, since
 * turning keeps its arcs' direction.
 */
const cutoutShapes = (
  model: DeviceModel,
  screen: DeviceRect,
  map: PointMap,
  isTurned: boolean
): DeviceShape[] => {
  const cutout = model.cutout;
  if (cutout === undefined) return [];
  const middle = screen.x + screen.width / 2;
  if (cutout.kind === "island") {
    const rect = placedRect(map, isTurned, {
      x: middle - cutout.width / 2,
      y: screen.y + cutout.top,
      width: cutout.width,
      height: cutout.height,
      radius: cutout.height / 2
    });
    return [{ kind: "rect", ...rect, fill: "cutout" }];
  }
  if (cutout.kind === "hole") {
    const [cx, cy] = map(middle, screen.y + cutout.top + cutout.diameter / 2);
    return [{ kind: "circle", cx: round(cx), cy: round(cy), r: cutout.diameter / 2, fill: "cutout" }];
  }
  // a notch: straight sides from the top edge, its lower corners rounded, its upper ones flaring into the edge
  const point = (x: number, y: number): string => {
    const [px, py] = map(x, y);
    return `${round(px)} ${round(py)}`;
  };
  const left = middle - cutout.width / 2;
  const right = middle + cutout.width / 2;
  const top = screen.y;
  const bottom = top + cutout.height;
  const flare = 6;
  const corner = 20;
  return [
    {
      kind: "path",
      d: [
        `M${point(left - flare, top)}`,
        `A${flare} ${flare} 0 0 1 ${point(left, top + flare)}`,
        `L${point(left, bottom - corner)}`,
        `A${corner} ${corner} 0 0 0 ${point(left + corner, bottom)}`,
        `L${point(right - corner, bottom)}`,
        `A${corner} ${corner} 0 0 0 ${point(right, bottom - corner)}`,
        `L${point(right, top + flare)}`,
        `A${flare} ${flare} 0 0 1 ${point(right + flare, top)}`,
        "Z"
      ].join(" "),
      fill: "cutout"
    }
  ];
};

/** The iOS signal bars, from their left, on a line through their middle; 17 px wide. */
const iosSignal = (x: number, y: number): DeviceShape[] =>
  [4, 6.3, 8.7, 11].map((height, index) => ({
    kind: "rect",
    x: round(x + index * 4.6),
    y: round(y + 5.5 - height),
    width: 3,
    height,
    radius: 1,
    fill: "ink"
  }));

/**
 * A fan of a Wi-Fi mark, as a path: the ring between two radii (none inside makes a wedge), a quarter turn wide,
 * pointing up from its centre.
 */
const fanBand = (cx: number, cy: number, outer: number, inner: number): string => {
  const at = (radius: number, degrees: number): string => {
    const angle = (degrees * Math.PI) / 180;
    return `${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`;
  };
  const inside =
    inner === 0
      ? `L${round(cx)} ${round(cy)}`
      : `L${at(inner, -45)} A${inner} ${inner} 0 0 0 ${at(inner, -135)}`;
  return `M${at(outer, -135)} A${outer} ${outer} 0 0 1 ${at(outer, -45)} ${inside} Z`;
};

/** The iOS Wi-Fi mark, three bands, from its left; 15.5 px wide. */
const iosWifi = (x: number, y: number): DeviceShape[] =>
  [
    [11, 8.6],
    [7.2, 4.8],
    [3.4, 0]
  ].map(([outer = 0, inner = 0]) => ({
    kind: "path",
    d: fanBand(x + 7.78, y + 5.5, outer, inner),
    fill: "ink"
  }));

/** The iOS battery, full, from its left; 27 px wide. */
const iosBattery = (x: number, y: number): DeviceShape[] => [
  { kind: "rect", x, y: y - 6, width: 24.3, height: 12, radius: 3.8, stroke: "ink", opacity: 0.4 },
  { kind: "rect", x: x + 2, y: y - 4, width: 20.3, height: 8, radius: 2.4, fill: "ink" },
  { kind: "rect", x: x + 25.3, y: y - 2, width: 1.5, height: 4, radius: 0.75, fill: "ink", opacity: 0.4 }
];

/** The Android signal, a triangle, from its left; 11 px wide. */
const androidSignal = (x: number, y: number): DeviceShape[] => [
  { kind: "path", d: `M${round(x)} ${round(y + 5.5)}H${round(x + 11)}V${round(y - 5.5)}Z`, fill: "ink" }
];

/** The Android Wi-Fi mark, one wedge, from its left; 14 px wide. */
const androidWifi = (x: number, y: number): DeviceShape[] => [
  { kind: "path", d: fanBand(x + 7, y + 4.5, 9.9, 0), fill: "ink" }
];

/** The Android battery, upright and full, from its left; 7 px wide. */
const androidBattery = (x: number, y: number): DeviceShape[] => [
  { kind: "rect", x: x + 2, y: y - 7.5, width: 3, height: 1.5, radius: 0.5, fill: "ink" },
  { kind: "rect", x, y: y - 6.5, width: 7, height: 13, radius: 1.5, fill: "ink" }
];

/** A row of marks from a left edge, each drawn by its maker and as wide as it says, with a gap between. */
const markRow = (x: number, y: number, marks: readonly StatusMark[], gap: number): DeviceShape[] => {
  let left = x;
  return marks.flatMap((mark) => {
    const shapes = mark.draw(left, y);
    left += mark.width + gap;
    return shapes;
  });
};

/** A row's width: its marks' and the gaps between them. */
const rowWidth = (marks: readonly { readonly width: number }[], gap: number): number =>
  marks.reduce((sum, mark) => sum + mark.width, 0) + gap * (marks.length - 1);

/** A mark of the status bar: what draws it, from its left, and how wide it is. */
type StatusMark = {
  /** Draws it from its left, on a line through its middle. */
  readonly draw: (x: number, y: number) => DeviceShape[];
  /** Its width, in CSS px. */
  readonly width: number;
};

/** The marks at an iPhone's status bar's end. */
const IOS_PHONE_MARKS: readonly StatusMark[] = [
  { draw: iosSignal, width: 17 },
  { draw: iosWifi, width: 15.5 },
  { draw: iosBattery, width: 27 }
];
/** The marks at an iPad's status bar's end. */
const IOS_TABLET_MARKS: readonly StatusMark[] = [
  { draw: iosWifi, width: 15.5 },
  { draw: iosBattery, width: 27 }
];
/** The marks at an Android device's status bar's end. */
const ANDROID_MARKS: readonly StatusMark[] = [
  { draw: androidWifi, width: 14 },
  { draw: androidSignal, width: 11 },
  { draw: androidBattery, width: 7 }
];

/**
 * An iPhone's status bar, upright: the time and the marks in the middle of the two ears the camera's cut leaves.
 */
const iphoneStatusBar = (model: DeviceModel, screen: DeviceRect): DeviceShape[] => {
  const { safeArea } = deviceScreen(model, "portrait");
  const cutout = model.cutout;
  const cutWidth = cutout?.kind === "island" || cutout?.kind === "notch" ? cutout.width : 0;
  const ear = (screen.width - cutWidth) / 2;
  const middle =
    cutout?.kind === "island" ? cutout.top + cutout.height / 2 : Math.min(safeArea.top / 2 + 1, 24);
  const y = screen.y + middle;
  const width = rowWidth(IOS_PHONE_MARKS, 5.5);
  return [
    {
      kind: "text",
      x: round(screen.x + ear / 2 + 4),
      y: round(y),
      text: STATUS_TIME,
      size: 17,
      weight: 600,
      anchor: "middle",
      fill: "ink"
    },
    ...markRow(screen.x + screen.width - ear / 2 - width / 2 - 4, y, IOS_PHONE_MARKS, 5.5)
  ];
};

/** The status bar, laid out for the screen as held; none on an iPhone on its side, as iOS shows none there. */
const statusBar = (model: DeviceModel, orientation: DeviceOrientation, screen: DeviceRect): DeviceShape[] => {
  const isUpright = orientation === "portrait";
  if (model.platform === "ios" && model.kind === "phone")
    return isUpright ? iphoneStatusBar(model, screen) : [];
  const { safeArea } = deviceScreen(model, orientation);
  const isTablet = model.kind === "tablet";
  const marks = model.platform === "ios" ? IOS_TABLET_MARKS : ANDROID_MARKS;
  const gap = model.platform === "ios" ? 5.5 : 6;
  const hole = model.cutout?.kind === "hole" ? model.cutout : undefined;
  // an upright punch hole sets the bar's middle; on its side the hole is at the left, out of the bar
  const middle =
    hole !== undefined && isUpright ? hole.top + hole.diameter / 2 : (isTablet ? 24 : safeArea.top) / 2;
  const y = screen.y + middle;
  const edge = isTablet ? 20 : 22;
  return [
    {
      kind: "text",
      x: round(screen.x + Math.max(edge, safeArea.left + 10)),
      y: round(y),
      text: STATUS_TIME,
      size: isTablet ? 13 : 14,
      weight: isTablet ? 600 : 500,
      anchor: "start",
      fill: "ink"
    },
    ...markRow(screen.x + screen.width - edge - rowWidth(marks, gap), y, marks, gap)
  ];
};

/** The home indicator at the screen's foot: iOS's bar, or Android's gesture handle. */
const homeIndicator = (
  model: DeviceModel,
  orientation: DeviceOrientation,
  screen: DeviceRect
): DeviceShape => {
  const isIos = model.platform === "ios";
  const phoneRatio = orientation === "portrait" ? 0.34 : 0.25;
  const ratio = model.kind === "tablet" ? 0.3 : phoneRatio;
  const width = isIos ? Math.min(315, screen.width * ratio) : 108;
  const height = isIos ? 5 : 4;
  return {
    kind: "rect",
    x: round(screen.x + (screen.width - width) / 2),
    y: round(screen.y + screen.height - 8 - height),
    width: round(width),
    height,
    radius: height / 2,
    fill: "ink"
  };
};

/**
 * A model drawn, held one way.
 *
 * @param model - the model.
 * @param orientation - how it is held: on its side, its top to the left.
 */
export const deviceDrawing = (model: DeviceModel, orientation: DeviceOrientation): DeviceDrawing => {
  const upright = uprightBox(model);
  const isTurned = orientation === "landscape";
  // turning the phone with its top to the left: the upright top edge becomes the left one
  const map: PointMap = isTurned
    ? (x: number, y: number): readonly [number, number] => [y, upright.width - x]
    : (x: number, y: number): readonly [number, number] => [x, y];
  const { band, bezel } = THICKNESS[model.kind];
  const body: DeviceRect = {
    x: BUTTON_DEPTH,
    y: BUTTON_DEPTH,
    width: upright.width - 2 * BUTTON_DEPTH,
    height: upright.height - 2 * BUTTON_DEPTH,
    radius: model.radius + bezel + band
  };
  const glass: DeviceRect = {
    x: body.x + band,
    y: body.y + band,
    width: body.width - 2 * band,
    height: body.height - 2 * band,
    radius: model.radius + bezel
  };
  const uprightScreen: DeviceRect = {
    x: upright.around,
    y: upright.around,
    width: model.width,
    height: model.height,
    radius: model.radius
  };
  const screen = placedRect(map, isTurned, uprightScreen);
  return {
    width: isTurned ? upright.height : upright.width,
    height: isTurned ? upright.width : upright.height,
    screen,
    under: [
      ...buttonRects(model, body).map(
        (rect): DeviceShape => ({
          kind: "rect",
          ...placedRect(map, isTurned, rect),
          fill: "frame",
          stroke: "edge"
        })
      ),
      { kind: "rect", ...placedRect(map, isTurned, body), fill: "frame", stroke: "edge" },
      { kind: "rect", ...placedRect(map, isTurned, glass), fill: "bezel" }
    ],
    over: [
      ...cutoutShapes(model, uprightScreen, map, isTurned),
      ...statusBar(model, orientation, screen),
      homeIndicator(model, orientation, screen)
    ]
  };
};
