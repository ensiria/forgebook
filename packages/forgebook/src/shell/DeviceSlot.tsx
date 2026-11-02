/**
 * The place of a story's frame that a device can be drawn around: always there, so turning the device on or off adds
 * the drawing beside the frame and never mounts the frame again (the story keeps its state), and the loader of the
 * device's parts, which only a framed story fetches.
 *
 * @remarks
 * The models' sizes, their drawings, the device menu and their styles are one chunk (`device/deviceParts.tsx`),
 * imported the first time a story is shown in a device: a catalogue that never shows one never loads it, so the
 * shell's first load does not grow with it. Until it arrives the story is shown as without a device, for the moment
 * a local chunk takes.
 *
 * @module
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";

import type { DeviceDrawing } from "../deviceDrawing.ts";
import type { ShownDevice } from "../deviceView.ts";
import type * as DevicePartsModule from "./device/deviceParts.tsx";
import type { StageViewportProps } from "./StageViewport.tsx";

/** The device's parts, as their chunk exports them. */
export type DeviceParts = typeof DevicePartsModule;

/** The chunk once it loaded, for every later use; none before. */
let loadedParts: DeviceParts | undefined;

/** The chunk while it loads, so two frames asking at once fetch it once. */
let loadingParts: Promise<DeviceParts> | undefined;

/**
 * The device's parts, loaded the first time they are needed.
 *
 * @param isNeeded - whether a device is to be drawn.
 * @returns the parts once loaded; none before, or when the chunk could not be fetched (the story is then shown
 *   without its device, never broken).
 */
export const useDeviceParts = (isNeeded: boolean): DeviceParts | undefined => {
  const [parts, setParts] = useState<DeviceParts | undefined>(loadedParts);
  useEffect(() => {
    if (!isNeeded || parts !== undefined) return;
    let isCurrent = true;
    loadingParts ??= import("./device/deviceParts.tsx");
    loadingParts.then(
      (loaded) => {
        loadedParts = loaded;
        if (isCurrent) setParts(loaded);
      },
      () => {
        // a failed fetch is forgotten so a later frame asks again; a browser may keep the failure until a reload,
        // and the story is shown without its device meanwhile
        loadingParts = undefined;
      }
    );
    return (): void => {
      isCurrent = false;
    };
  }, [isNeeded, parts]);
  return parts;
};

/** A device ready to draw: its parts, which device, and its drawing. */
export type FramedDevice = {
  /** The parts that draw it. */
  readonly parts: DeviceParts;
  /** The device shown. */
  readonly shown: ShownDevice;
  /** Its drawing. */
  readonly drawing: DeviceDrawing;
};

/**
 * The device a story is drawn in, once its parts are there.
 *
 * @param shown - the device shown; none for no device.
 */
export const useFramedDevice = (shown: ShownDevice | undefined): FramedDevice | undefined => {
  const parts = useDeviceParts(shown !== undefined);
  const model = shown?.model;
  const orientation = shown?.orientation;
  return useMemo(
    () =>
      parts === undefined || model === undefined || orientation === undefined
        ? undefined
        : { parts, shown: { model, orientation }, drawing: parts.drawingOf({ model, orientation }) },
    [parts, model, orientation]
  );
};

/** The slot's props. */
export type DeviceSlotProps = {
  /** The device drawn around the frame; none shows the frame alone. */
  readonly framed: FramedDevice | undefined;
  /** The story's scheme, which the status bar's ink follows. */
  readonly scheme: "light" | "dark";
  /** The colour of the story's page, which the screen waits on while the story loads. */
  readonly background?: string | undefined;
  /** The frame. */
  readonly children: ReactNode;
};

/**
 * The frame's place, with the device around it when there is one: the parts draw it, this place stays.
 *
 * @param props - the device, the story's scheme and page colour, and the frame.
 */
export const DeviceSlot = ({ framed, scheme, background, children }: DeviceSlotProps): ReactNode => {
  const framing = framed?.parts.deviceFraming(framed, scheme, background);
  return (
    <div className="forgebook-device" {...framing?.root}>
      {framing?.under}
      <div className="forgebook-device__screen" style={framing?.screen}>
        {children}
      </div>
      {framing?.over}
    </div>
  );
};

/**
 * The scheme a story is drawn in, for the status bar's ink: its colour scheme switch's, the system's for `system`.
 *
 * @param scheme - the view's scheme (`schemeOf`).
 * @param isSystemDark - whether the system is dark.
 */
export const inkScheme = (scheme: "light" | "dark" | "system", isSystemDark: boolean): "light" | "dark" => {
  if (scheme !== "system") return scheme;
  return isSystemDark ? "dark" : "light";
};

/** What sizes a story's room on the stage, and what the stage's handles and its width field are told. */
export type RoomSizing = Pick<
  StageViewportProps,
  "width" | "onWidthChange" | "onShownWidthChange" | "background" | "height" | "onHeightChange" | "isDevice"
>;

/**
 * The room's sizing with a device: the device's size, no handles (the device sets the width and the height), no
 * surface of the room's own; the stage's own sizing without one.
 *
 * @param framed - the device; none keeps the stage's own.
 * @param own - the stage's own sizing.
 */
export const roomSizing = (framed: FramedDevice | undefined, own: RoomSizing): RoomSizing =>
  framed === undefined
    ? own
    : {
        width: framed.drawing.width,
        onWidthChange: undefined,
        onShownWidthChange: undefined,
        background: undefined,
        height: "auto",
        onHeightChange: undefined,
        isDevice: true
      };
