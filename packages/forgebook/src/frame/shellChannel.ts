/**
 * A frame's side of the messages with the shell: it tells only the catalogue's origin, and hears only its parent page
 * on that origin.
 *
 * @remarks
 * The frame works out the catalogue's origin from the placement and its own address, never from its address's query:
 * a page that framed a story could otherwise name itself the catalogue and send the story values (a prop's `href`) no
 * panel would set. A frame opened alone, with no parent, tells nobody.
 *
 * @module
 */
import { type FramesPlacement, type PageLocation, pageOrigins } from "../frameOrigins.ts";
import { type FrameMessage, isShellMessage, type ShellMessage } from "../messages.ts";

/** A message's event, as the frame reads it. */
export type ShellEvent = {
  /** The sender's origin. */
  readonly origin: string;
  /** The sender's window. */
  readonly source: unknown;
  /** The message. */
  readonly data: unknown;
};

/** What the channel uses of the frame's window. */
export type FrameWindow = {
  /** The frame's address. */
  readonly location: PageLocation;
  /** The page that holds the frame; the frame itself when it is opened alone. */
  readonly parent: { readonly postMessage: (message: unknown, targetOrigin: string) => void };
  /** Listens to the messages the frame receives. */
  readonly addEventListener: (type: "message", listener: (event: ShellEvent) => void) => void;
};

/** How a frame talks with its shell. */
export type ShellChannel = {
  /** Tells the shell. */
  readonly tell: (message: FrameMessage) => void;
  /** Hears the shell: each message the parent page sends from the catalogue's origin. */
  readonly listen: (onMessage: (message: ShellMessage) => void) => void;
};

/**
 * The frame's channel with its shell.
 *
 * @param placement - where the frames run.
 * @param frame - the frame's window.
 */
export const shellChannel = (placement: FramesPlacement, frame: FrameWindow): ShellChannel => {
  const { catalogue } = pageOrigins(placement, frame.location, "frame");
  // a frame opened alone is its own parent
  const parent: unknown = frame.parent;
  const hasParent = parent !== frame;
  return {
    tell: (message: FrameMessage): void => {
      if (hasParent) frame.parent.postMessage(message, catalogue);
    },
    listen: (onMessage: (message: ShellMessage) => void): void => {
      frame.addEventListener("message", (event: ShellEvent): void => {
        if (!hasParent || event.source !== frame.parent || event.origin !== catalogue) return;
        if (isShellMessage(event.data)) onMessage(event.data);
      });
    }
  };
};
