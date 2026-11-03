/**
 * The shell's side of the messages with the stories' frames: the frames' origin, the only one the shell sends to and
 * listens to, and what each frame element the shell draws is allowed (the stage's, a page's, the design comparison's).
 *
 * @remarks
 * A page holds one shell, and its frames run on one origin for the page's life, so the origin is a fact of the page,
 * set once by `mountShell` before anything renders, as the page's address is. A message from anywhere else is not a
 * frame's, and a message sent with the frames' origin never reaches a document that is not one of them.
 *
 * @module
 */
/** The frames' origin, once `mountShell` set it. */
let pageFramesOrigin: string | undefined;

/**
 * Sets the frames' origin, before the shell renders.
 *
 * @param origin - the frames' origin (`http://localhost:5174`).
 */
export const setFramesOrigin = (origin: string): void => {
  pageFramesOrigin = origin;
};

/** The frames' origin: the catalogue's own until `mountShell` sets it. */
export const framesOrigin = (): string => pageFramesOrigin ?? window.location.origin;

/**
 * Whether a message comes from the frames' origin.
 *
 * @param event - the message's event.
 */
export const isFromFrames = (event: MessageEvent): boolean => event.origin === framesOrigin();

/**
 * The browser features a story may use, delegated to its frame. A frame on the catalogue's own origin had each of them;
 * on an origin of its own it gets only those its element allows (a copy button, a video's full screen, a scanner's
 * camera).
 */
const FRAME_PERMISSIONS = [
  "clipboard-read",
  "clipboard-write",
  "fullscreen",
  "camera",
  "microphone",
  "geolocation",
  "display-capture",
  "autoplay",
  "picture-in-picture",
  "encrypted-media",
  "screen-wake-lock"
].join("; ");

/**
 * What a story's frame may do, as a sandbox: everything a page does but navigate the catalogue's tab, which a story's
 * link could otherwise send to any address. The frames keep their own origin (`allow-same-origin`): it is not the
 * catalogue's, so the pair gives the story nothing of the catalogue's. Frames on the catalogue's own origin get none:
 * there the pair would let a story lift its own sandbox, and browsers warn of it.
 */
const FRAME_SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-modals",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-downloads",
  "allow-pointer-lock",
  "allow-presentation"
].join(" ");

/** What a story's frame element is given, wherever the shell draws one. */
export type StoryFrameAttributes = {
  /** The browser features it may use. */
  readonly allow: string;
  /** Its sandbox; none on the catalogue's own origin. */
  readonly sandbox: string | undefined;
};

/** The attributes of a story's frame element: the features it is delegated, and its sandbox off the catalogue's origin. */
export const storyFrameAttributes = (): StoryFrameAttributes => ({
  allow: FRAME_PERMISSIONS,
  sandbox: framesOrigin() === window.location.origin ? undefined : FRAME_SANDBOX
});
