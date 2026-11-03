/**
 * Where a catalogue's frames run, and the two origins the shell and the frames talk on: the shell sends only to the
 * frames' origin and listens only to it, a frame the same with the catalogue's.
 *
 * @remarks
 * A story's frame runs on an origin of its own wherever one can be had, so what runs in it (the story's code, a value a
 * shared link put in a prop) cannot read or act on the catalogue's page, the dev server's agent API or the files Vite
 * serves. The dev server gives the frames a second port (`ports`); a static build gets a second host only when the
 * configuration names it (`origins`); otherwise they share the catalogue's (`same-origin`).
 *
 * Each side works out the other's origin from the placement and its own address, never from a value in the address:
 * a page that framed a story while naming itself the catalogue could otherwise send it values.
 *
 * @module
 */

/** Where the frames run, as the pages read it from the configuration's data. */
export type FramesPlacement =
  | {
      /** On the catalogue's own origin. */
      readonly kind: "same-origin";
    }
  | {
      /** On another port of the same host: the dev server's second port. */
      readonly kind: "ports";
      /** The catalogue's port. */
      readonly catalogue: number;
      /** The frames' port. */
      readonly frames: number;
    }
  | {
      /** On origins the configuration names, as the browser reaches them. */
      readonly kind: "origins";
      /** The catalogue's origin (`https://catalogue.example.com`). */
      readonly catalogue: string;
      /** The frames' origin (`https://frames.example.com`). */
      readonly frames: string;
    };

/** The frames on the catalogue's own origin. */
export const SAME_ORIGIN: FramesPlacement = { kind: "same-origin" };

/** The two origins of a catalogue's page and its frames. */
export type PageOrigins = {
  /** The catalogue page's origin. */
  readonly catalogue: string;
  /** The frames' origin. */
  readonly frames: string;
};

/** What a page knows of its own address. */
export type PageLocation = Pick<Location, "protocol" | "hostname" | "origin">;

/**
 * An origin on a host and a port: the default port left out, as a browser writes an origin.
 *
 * @param location - the page's address, whose scheme and host it keeps.
 * @param port - the port.
 */
const originOnPort = (location: PageLocation, port: number): string =>
  new URL(`${location.protocol}//${location.hostname}:${port}`).origin;

/**
 * The two origins, seen from one of the pages.
 *
 * @param placement - where the frames run.
 * @param location - the page's own address.
 * @param side - which page asks: the catalogue's, or a frame.
 */
export const pageOrigins = (
  placement: FramesPlacement,
  location: PageLocation,
  side: "catalogue" | "frame"
): PageOrigins => {
  if (placement.kind === "origins") return { catalogue: placement.catalogue, frames: placement.frames };
  if (placement.kind === "same-origin") return { catalogue: location.origin, frames: location.origin };
  return side === "catalogue"
    ? { catalogue: location.origin, frames: originOnPort(location, placement.frames) }
    : { catalogue: originOnPort(location, placement.catalogue), frames: location.origin };
};

/**
 * The frame page's address, for the catalogue's page: the page named relative to the catalogue's path, on the frames'
 * origin, so a catalogue served under a sub-path (`/pr-12/`) finds its frames under the same one.
 *
 * @param framePage - the frame page, relative to the catalogue's (`frame.html`).
 * @param framesOrigin - the frames' origin.
 * @param pathname - the catalogue page's path (`/pr-12/`).
 */
export const framePageAddress = (framePage: string, framesOrigin: string, pathname: string): string =>
  new URL(framePage, `${framesOrigin}${pathname}`).href;
