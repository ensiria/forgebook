/**
 * A story's picture in a device, for `forgebook shot` (`@forgebook/testing`): the device a view names, the viewport it
 * gives the story, and the page that draws the story's picture in the device the shell draws (`deviceDrawing.ts`).
 *
 * @remarks
 * The page is made from the drawing's shapes as SVG, with the picture as an image in the screen, so the picture is
 * the story's held start, as an unframed one is. The hardware takes the story's scheme (a dark story in a dark
 * device), since a picture has no shell appearance to follow. The one export the testing package reads, so the
 * drawing's own shapes stay Forgebook's to change. Pure.
 *
 * @module
 */
import {
  DEVICE_FONT,
  DEVICE_INK,
  DEVICE_PAINTS,
  type DeviceDrawing,
  type DevicePaint,
  type DeviceShape,
  deviceDrawing
} from "./deviceDrawing.ts";
import { deviceModel, storyArea } from "./devices.ts";
import { type DeviceView, NO_DEVICE, type ShownDevice, shownDevice } from "./deviceView.ts";
import { withSafeArea } from "./safeAreaParameter.ts";

/** A text made safe inside markup. */
const escaped = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * One shape as SVG markup.
 *
 * @param shape - the shape.
 * @param paint - the colour of each paint.
 */
const shapeMarkup = (shape: DeviceShape, paint: (name: DevicePaint) => string): string => {
  if (shape.kind === "rect") {
    const fill = shape.fill === undefined ? "none" : paint(shape.fill);
    const stroke = shape.stroke === undefined ? "" : ` stroke="${paint(shape.stroke)}" stroke-width="1"`;
    const opacity = shape.opacity === undefined ? "" : ` opacity="${shape.opacity}"`;
    return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.radius}" fill="${fill}"${stroke}${opacity}/>`;
  }
  if (shape.kind === "circle")
    return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${paint(shape.fill)}"/>`;
  if (shape.kind === "path") return `<path d="${shape.d}" fill="${paint(shape.fill)}"/>`;
  return `<text x="${shape.x}" y="${shape.y}" font-size="${shape.size}" font-weight="${shape.weight}" text-anchor="${shape.anchor}" dominant-baseline="central" fill="${paint(shape.fill)}">${escaped(shape.text)}</text>`;
};

/**
 * A layer of the drawing as an SVG covering the page.
 *
 * @param drawing - the drawing.
 * @param shapes - the layer's shapes.
 * @param paint - the colour of each paint.
 */
const layerMarkup = (
  drawing: DeviceDrawing,
  shapes: readonly DeviceShape[],
  paint: (name: DevicePaint) => string
): string =>
  `<svg width="${drawing.width}" height="${drawing.height}" viewBox="0 0 ${drawing.width} ${drawing.height}" style="position:absolute;inset:0" font-family="${escaped(DEVICE_FONT)}">${shapes.map((shape) => shapeMarkup(shape, paint)).join("")}</svg>`;

/** The device a view names: a model, held one way. */
export type NamedDevice = ShownDevice;

/** A story's picture framed in a device: the page that draws it, and its size. */
export type FramedPicture = {
  /** The page: the device's drawing with the picture in its screen, outside it transparent. */
  readonly html: string;
  /** The page's width, in CSS px. */
  readonly width: number;
  /** The page's height, in CSS px. */
  readonly height: number;
};

/** What a framed picture is made of. */
export type PictureRequest = {
  /** The device and how it is held. */
  readonly shown: NamedDevice;
  /** Whether the story draws edge to edge (`parameters.device.edgeToEdge`); inside the safe areas otherwise. */
  readonly isEdgeToEdge: boolean;
  /** The story's picture at its area's size (`deviceViewport`), a PNG as base64. */
  readonly picture: string;
  /** The story's scheme, which the hardware and the status bar's ink follow. */
  readonly scheme: "light" | "dark";
  /** The colour of the story's page, which fills the screen around a story inside the safe areas, as a CSS colour. */
  readonly background: string;
};

/** A CSS colour as the browser computes one (`rgb(242, 242, 247)`, `#fff`); anything else is drawn transparent. */
const safeColour = (colour: string): string => (/^[#a-z0-9(),.%\s]+$/i.test(colour) ? colour : "transparent");

/**
 * The page that draws a story's picture in a device: the story in its area of the screen, the screen around it on
 * the story's page colour.
 *
 * @param request - the device, the picture, the story's scheme and page colour.
 */
export const framedPicture = (request: PictureRequest): FramedPicture => {
  const { shown, scheme } = request;
  const model = deviceModel(shown.model);
  const drawing = deviceDrawing(model, shown.orientation);
  const area = storyArea(model, shown.orientation, request.isEdgeToEdge);
  const paints = DEVICE_PAINTS[scheme];
  const paint = (name: DevicePaint): string => (name === "ink" ? DEVICE_INK[scheme] : paints[name]);
  const { screen } = drawing;
  const html = [
    "<!doctype html>",
    '<html><body style="margin:0;background:transparent">',
    `<div style="position:relative;width:${drawing.width}px;height:${drawing.height}px">`,
    layerMarkup(drawing, drawing.under, paint),
    `<div style="position:absolute;overflow:hidden;left:${screen.x}px;top:${screen.y}px;width:${screen.width}px;height:${screen.height}px;border-radius:${screen.radius}px;background:${safeColour(request.background)}">`,
    `<img alt="" src="data:image/png;base64,${request.picture}" style="position:absolute;left:${area.around.left}px;top:${area.around.top}px;width:${area.width}px;height:${area.height}px">`,
    "</div>",
    layerMarkup(drawing, drawing.over, paint),
    "</div></body></html>"
  ].join("");
  return { html, width: drawing.width, height: drawing.height };
};

/**
 * The device a view names, for a picture or a check: a model's id in the view; a story's own default never counts,
 * so pictures and tests stay unframed unless asked.
 *
 * @param view - the view's device and orientation.
 */
export const namedDevice = (view: DeviceView): NamedDevice | undefined => {
  const shown = shownDevice(view, NO_DEVICE);
  return shown === undefined ? undefined : { model: shown.model, orientation: shown.orientation };
};

/**
 * The viewport a device gives a story, held as shown: inside the safe areas, or the whole screen edge to edge.
 *
 * @param shown - the device and how it is held.
 * @param isEdgeToEdge - whether the story draws edge to edge.
 */
export const deviceViewport = (
  shown: NamedDevice,
  isEdgeToEdge: boolean
): { readonly width: number; readonly height: number } => {
  const { width, height } = storyArea(deviceModel(shown.model), shown.orientation, isEdgeToEdge);
  return { width, height };
};

/**
 * A story frame's address in a device: told the safe areas when it draws edge to edge, as it is otherwise.
 *
 * @param address - the frame's address.
 * @param shown - the device and how it is held.
 * @param isEdgeToEdge - whether the story draws edge to edge.
 */
export const deviceFrameAddress = (address: string, shown: NamedDevice, isEdgeToEdge: boolean): string =>
  isEdgeToEdge
    ? withSafeArea(address, storyArea(deviceModel(shown.model), shown.orientation, true).safeArea)
    : address;
