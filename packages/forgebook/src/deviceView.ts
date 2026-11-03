/**
 * Which device frame a story is shown in: the models' ids, the default a catalogue and a story set
 * (`parameters.device`), and the view's own choice, kept in the address (`device`, `orientation`).
 *
 * @remarks
 * Only the ids live here, not the models' sizes and drawings (`devices.ts`, `deviceDrawing.ts`): this module is read
 * on the shell's first load and by the address's parser, and a catalogue that never shows a frame should not load
 * them. The view's `auto` follows the story's default, so a link without `device` shows each story as its author
 * meant; `off` and a model id are the person's choice, which wins. Pure.
 *
 * @module
 */
import type { DeviceOrientation, StoryDeviceSetting } from "@forgebook/story-format/csf";

/** What a device is: a phone, or a tablet. */
export type DeviceKind = "phone" | "tablet";

/**
 * Every model as the menu lists it, in its order: phones first, then tablets, the generic phone last of the phones;
 * its sizes and drawing are `devices.ts`'. The one list of the ids, so the address, the index and the menu agree.
 */
// biome-ignore lint/nursery/useExplicitType: the ids' type is this list's own (`DeviceId`); a written one would repeat every id
export const DEVICE_ENTRIES = [
  { id: "iphone-16", name: "iPhone 16", kind: "phone" },
  { id: "iphone-16-pro-max", name: "iPhone 16 Pro Max", kind: "phone" },
  { id: "iphone-16e", name: "iPhone 16e", kind: "phone" },
  { id: "pixel-9", name: "Pixel 9", kind: "phone" },
  { id: "galaxy-s24", name: "Galaxy S24", kind: "phone" },
  { id: "phone", name: "Generic phone", kind: "phone" },
  { id: "ipad-mini", name: "iPad mini", kind: "tablet" },
  { id: "ipad-pro-13", name: "iPad Pro 13″", kind: "tablet" }
] as const satisfies readonly {
  readonly id: string;
  readonly name: string;
  readonly kind: DeviceKind;
}[];

/** A device model's id. */
export type DeviceId = (typeof DEVICE_ENTRIES)[number]["id"];

/** A model as the menu lists it: its id, its name (the generic phone's is the shell's text) and its kind. */
export type DeviceEntry = {
  /** Its id. */
  readonly id: DeviceId;
  /** Its name; the generic phone's is the shell's text (`deviceGeneric`). */
  readonly name: string;
  /** A phone or a tablet, the menu's groups. */
  readonly kind: DeviceKind;
};

/** The models' ids, in the menu's order. */
export const DEVICE_IDS: readonly DeviceId[] = DEVICE_ENTRIES.map((entry) => entry.id);

/**
 * The address's parameter of the view's device. Forgebook's own parameters have plain names (`width`, `zoom`), but
 * `device` and `orientation` are names a catalogue may well give its own switches, so these two take Forgebook's name
 * before them: a catalogue's `device` switch keeps its parameter. A dot, not a colon, so the address shows it as is.
 */
export const DEVICE_PARAMETER = "forgebook.device";

/** The address's parameter of how the device is held, under Forgebook's name as `DEVICE_PARAMETER` is. */
export const ORIENTATION_PARAMETER = "forgebook.orientation";

/** The model shown when nothing names one: a generic phone, so no brand is the catalogue's default. */
export const DEFAULT_DEVICE: DeviceId = "phone";

/** How a device is held, in the menu's order. */
export const DEVICE_ORIENTATIONS: readonly DeviceOrientation[] = ["portrait", "landscape"];

/**
 * Whether a text is a device model's id.
 *
 * @param value - the text.
 */
export const isDeviceId = (value: unknown): value is DeviceId => DEVICE_IDS.some((id) => id === value);

/**
 * Whether a text is an orientation.
 *
 * @param value - the text.
 */
export const isDeviceOrientation = (value: unknown): value is DeviceOrientation =>
  DEVICE_ORIENTATIONS.some((orientation) => orientation === value);

/**
 * The view's device: `auto` follows the story's default, `off` shows no frame whatever the story says, a model's id
 * shows that model.
 */
export type DeviceChoice = "auto" | "off" | DeviceId;

/** The view's orientation: `auto` follows the story's default. */
export type OrientationChoice = "auto" | DeviceOrientation;

/** A default with every field filled: the catalogue's, or a story's over it. */
export type DeviceDefault = {
  /** Whether the story starts in the frame. */
  readonly isFramed: boolean;
  /** The model the frame shows, and the one the toggle turns on. */
  readonly model: DeviceId;
  /** How the device is held. */
  readonly orientation: DeviceOrientation;
  /** Whether a story shown in the device is touched with a simulated finger, as a phone is. */
  readonly isTouch: boolean;
  /** Whether the story draws edge to edge, told the safe areas, instead of sitting inside them. */
  readonly isEdgeToEdge: boolean;
};

/** The default when no one sets one: no frame, the generic phone upright, touched once framed. */
export const NO_DEVICE: DeviceDefault = {
  isFramed: false,
  model: DEFAULT_DEVICE,
  orientation: "portrait",
  isTouch: true,
  isEdgeToEdge: false
};

/** The device a story is shown in: a model, held one way. */
export type ShownDevice = {
  /** The model. */
  readonly model: DeviceId;
  /** How it is held. */
  readonly orientation: DeviceOrientation;
};

/** The device a story is shown in, and whether it is touched there. */
export type StoryDevice = ShownDevice & {
  /** Whether the story is touched with a simulated finger, unless the reader turns it off. */
  readonly isTouch: boolean;
  /** Whether the story draws edge to edge, told the safe areas. */
  readonly isEdgeToEdge: boolean;
};

/**
 * Why a device setting cannot be used, or none: a model no one has, an orientation that is none.
 *
 * @param setting - the setting, as a catalogue or a story writes it.
 */
export const deviceSettingProblem = (setting: {
  readonly model?: string;
  readonly orientation?: string;
}): string | undefined => {
  if (setting.model !== undefined && !isDeviceId(setting.model))
    return `"${setting.model}" is no device model; the models are ${DEVICE_IDS.join(", ")}`;
  if (setting.orientation !== undefined && !isDeviceOrientation(setting.orientation))
    return `"${setting.orientation}" is no orientation; write portrait or landscape`;
  return undefined;
};

/**
 * A default with a setting over it: each field the setting gives replaces the default's, one it cannot use is left
 * out (the index and the configuration report it).
 *
 * @param base - the default underneath: the catalogue's, or `NO_DEVICE`.
 * @param setting - the setting over it: a story's, its own over its meta's; none leaves the default.
 */
export const deviceDefaultOf = (
  base: DeviceDefault,
  setting: StoryDeviceSetting | undefined
): DeviceDefault => ({
  isFramed: setting?.frame ?? base.isFramed,
  model: isDeviceId(setting?.model) ? setting.model : base.model,
  orientation: isDeviceOrientation(setting?.orientation) ? setting.orientation : base.orientation,
  isTouch: setting?.touch ?? base.isTouch,
  isEdgeToEdge: setting?.edgeToEdge ?? base.isEdgeToEdge
});

/**
 * The default of a page of several stories (a component's): the first story framed by default, so the toggle reads
 * on while any is framed and turning it off shows them all without one; the catalogue's when none is.
 *
 * @param base - the catalogue's default.
 * @param settings - the stories' settings, in the page's order.
 */
export const pageDeviceDefault = (
  base: DeviceDefault,
  settings: readonly (StoryDeviceSetting | undefined)[]
): DeviceDefault =>
  settings.map((setting) => deviceDefaultOf(base, setting)).find((each) => each.isFramed) ?? base;

/** The view's part about the device. */
export type DeviceView = {
  /** The device. */
  readonly device: DeviceChoice;
  /** How it is held. */
  readonly orientation: OrientationChoice;
};

/**
 * The device a story is shown in, or none: the view's choice, the story's default where the view leaves it.
 *
 * @param view - the view's device and orientation.
 * @param story - the story's default (the catalogue's under its own).
 */
export const shownDevice = (view: DeviceView, story: DeviceDefault): StoryDevice | undefined => {
  if (view.device === "off" || (view.device === "auto" && !story.isFramed)) return undefined;
  return {
    model: view.device === "auto" ? story.model : view.device,
    orientation: view.orientation === "auto" ? story.orientation : view.orientation,
    isTouch: story.isTouch,
    isEdgeToEdge: story.isEdgeToEdge
  };
};

/**
 * The view with the frame turned on or off: the address keeps only what differs from the story's default.
 *
 * @param view - the view.
 * @param story - the story's default.
 * @param isOn - whether the frame is to be shown.
 */
export const withFrame = <View extends DeviceView>(view: View, story: DeviceDefault, isOn: boolean): View => {
  if (isOn) return { ...view, device: story.isFramed ? "auto" : story.model };
  return { ...view, device: story.isFramed ? "off" : "auto" };
};
