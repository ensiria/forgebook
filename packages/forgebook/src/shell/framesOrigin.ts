/**
 * The shell's side of the messages with the stories' frames: the frames' origin, the only one the shell sends to and
 * listens to.
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
