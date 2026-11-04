/**
 * The device models a story can be shown in: each one's viewport in CSS px, its screen's corner radius, its safe
 * areas held either way, and the cut its camera makes in the screen.
 *
 * @remarks
 * The sizes are the CSS viewports the devices' browsers report (a full-screen web app's: the status bar included),
 * the safe areas what `env(safe-area-inset-*)` gives a page that covers the screen. Apple publishes its numbers;
 * Android's vary with the system's settings, so theirs are the stock system's status bar and gesture bar. Loaded only
 * where a frame is drawn (the shell's frame, `forgebook shot`) and by the Node side that checks a model's id. Pure.
 *
 * @module
 */
import type { DeviceOrientation } from "@forgebook/story-format/csf";

import { DEVICE_ENTRIES, type DeviceEntry, type DeviceId } from "./deviceView.ts";

/** Lengths on each side, in CSS px. */
export type Insets = {
  /** At the top. */
  readonly top: number;
  /** At the right. */
  readonly right: number;
  /** At the bottom. */
  readonly bottom: number;
  /** At the left. */
  readonly left: number;
};

/** The system a device runs, which draws its status bar and its home indicator its own way. */
export type DevicePlatform = "ios" | "android";

/**
 * The cut a front camera makes in the screen, upright: an island (a pill floating under the top edge), a notch (cut
 * from the top edge), or a hole (a round punch under the top edge). Lengths in CSS px.
 */
export type DeviceCutout =
  | {
      /** A pill floating under the top edge. */
      readonly kind: "island";
      /** Its width. */
      readonly width: number;
      /** Its height. */
      readonly height: number;
      /** How far under the top edge it floats. */
      readonly top: number;
    }
  | {
      /** A cut from the top edge, its lower corners rounded. */
      readonly kind: "notch";
      /** Its width. */
      readonly width: number;
      /** Its height. */
      readonly height: number;
    }
  | {
      /** A round punch under the top edge. */
      readonly kind: "hole";
      /** Its diameter. */
      readonly diameter: number;
      /** How far under the top edge it sits. */
      readonly top: number;
    };

/** A device model: its entry in the menu, and its hardware. */
export type DeviceModel = DeviceEntry & {
  /** Its system. */
  readonly platform: DevicePlatform;
  /** Its viewport's width upright, in CSS px. */
  readonly width: number;
  /** Its viewport's height upright, in CSS px. */
  readonly height: number;
  /** Its screen's corner radius, in CSS px; 0 for square corners. */
  readonly radius: number;
  /** Its safe areas, upright and on its side (its top to the left). */
  readonly safeArea: Readonly<Record<DeviceOrientation, Insets>>;
  /** The cut its front camera makes in the screen; none when the camera sits in the bezel. */
  readonly cutout?: DeviceCutout;
};

/** Every model, by id. */
const HARDWARE: Readonly<Record<DeviceId, Omit<DeviceModel, keyof DeviceEntry>>> = {
  "iphone-16": {
    platform: "ios",
    width: 393,
    height: 852,
    radius: 55,
    safeArea: {
      portrait: { top: 59, right: 0, bottom: 34, left: 0 },
      landscape: { top: 0, right: 59, bottom: 21, left: 59 }
    },
    cutout: { kind: "island", width: 125, height: 37, top: 11 }
  },
  "iphone-16-pro-max": {
    platform: "ios",
    width: 440,
    height: 956,
    radius: 62,
    safeArea: {
      portrait: { top: 62, right: 0, bottom: 34, left: 0 },
      landscape: { top: 0, right: 62, bottom: 21, left: 62 }
    },
    cutout: { kind: "island", width: 125, height: 37, top: 14 }
  },
  "iphone-16e": {
    platform: "ios",
    width: 390,
    height: 844,
    radius: 47,
    safeArea: {
      portrait: { top: 47, right: 0, bottom: 34, left: 0 },
      landscape: { top: 0, right: 47, bottom: 21, left: 47 }
    },
    cutout: { kind: "notch", width: 162, height: 33 }
  },
  "pixel-9": {
    platform: "android",
    width: 412,
    height: 923,
    radius: 44,
    safeArea: {
      portrait: { top: 48, right: 0, bottom: 24, left: 0 },
      landscape: { top: 24, right: 0, bottom: 16, left: 48 }
    },
    cutout: { kind: "hole", diameter: 24, top: 12 }
  },
  "galaxy-s24": {
    platform: "android",
    width: 360,
    height: 780,
    radius: 32,
    safeArea: {
      portrait: { top: 36, right: 0, bottom: 24, left: 0 },
      landscape: { top: 24, right: 0, bottom: 16, left: 36 }
    },
    cutout: { kind: "hole", diameter: 20, top: 9 }
  },
  phone: {
    platform: "android",
    width: 360,
    height: 800,
    radius: 28,
    safeArea: {
      portrait: { top: 32, right: 0, bottom: 24, left: 0 },
      landscape: { top: 24, right: 0, bottom: 16, left: 0 }
    }
  },
  "ipad-mini": {
    platform: "ios",
    width: 744,
    height: 1133,
    radius: 22,
    safeArea: {
      portrait: { top: 24, right: 0, bottom: 20, left: 0 },
      landscape: { top: 24, right: 0, bottom: 20, left: 0 }
    }
  },
  "ipad-pro-13": {
    platform: "ios",
    width: 1032,
    height: 1376,
    radius: 30,
    safeArea: {
      portrait: { top: 24, right: 0, bottom: 20, left: 0 },
      landscape: { top: 24, right: 0, bottom: 20, left: 0 }
    }
  }
};

/** Every model, in the menu's order. */
export const DEVICE_MODELS: readonly DeviceModel[] = DEVICE_ENTRIES.map((entry) => ({
  ...entry,
  ...HARDWARE[entry.id]
}));

/**
 * A model by its id.
 *
 * @param id - the model's id.
 */
export const deviceModel = (id: DeviceId): DeviceModel => {
  const entry = DEVICE_ENTRIES.find((each) => each.id === id) ?? { id, name: id, kind: "phone" };
  return { ...entry, ...HARDWARE[id] };
};

/** A model's screen, held one way: what the story gets. */
export type DeviceScreen = {
  /** The viewport's width, in CSS px. */
  readonly width: number;
  /** The viewport's height, in CSS px. */
  readonly height: number;
  /** The safe areas, in CSS px. */
  readonly safeArea: Insets;
};

/**
 * A model's screen, held one way: on its side, its width and height swap.
 *
 * @param model - the model.
 * @param orientation - how it is held.
 */
export const deviceScreen = (model: DeviceModel, orientation: DeviceOrientation): DeviceScreen =>
  orientation === "portrait"
    ? { width: model.width, height: model.height, safeArea: model.safeArea.portrait }
    : { width: model.height, height: model.width, safeArea: model.safeArea.landscape };

/** No room on any side. */
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The part of a device's screen a story is drawn in, and the safe areas it is told. */
export type StoryArea = {
  /** Its width: the story's viewport, in CSS px. */
  readonly width: number;
  /** Its height, in CSS px. */
  readonly height: number;
  /** The room around it on the screen, which the status bar, the camera's cut and the home indicator take. */
  readonly around: Insets;
  /** The safe areas the story is told: the screen's for a story drawn edge to edge, none for one inside them. */
  readonly safeArea: Insets;
};

/**
 * The part of a device's screen a story is drawn in: inside the safe areas, as a page in a phone's browser or an app
 * that respects them is, so nothing the device draws covers it; or the whole screen for a story drawn edge to edge,
 * told the safe areas to pad itself with.
 *
 * @param model - the model.
 * @param orientation - how it is held.
 * @param isEdgeToEdge - whether the story draws edge to edge.
 */
export const storyArea = (
  model: DeviceModel,
  orientation: DeviceOrientation,
  isEdgeToEdge: boolean
): StoryArea => {
  const screen = deviceScreen(model, orientation);
  if (isEdgeToEdge)
    return { width: screen.width, height: screen.height, around: NO_INSETS, safeArea: screen.safeArea };
  const { top, right, bottom, left } = screen.safeArea;
  return {
    width: screen.width - left - right,
    height: screen.height - top - bottom,
    around: screen.safeArea,
    safeArea: NO_INSETS
  };
};
