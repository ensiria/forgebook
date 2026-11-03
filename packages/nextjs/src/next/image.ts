/**
 * `next/image` in a catalogue: Next.js's own image component, so a story's images are drawn as the app's are, with
 * the settings the Vite plugin gives the page (drawn as they are, or by the project's `loaderFile`).
 *
 * @module
 */

import external from "next/dist/shared/lib/image-external.js";
import type NextImage from "next/image";
import type { getImageProps as nextGetImageProps } from "next/image";

import { defaultExport, isComponentLike } from "./interop.ts";

/** Whether a value is the image component. */
const isImage = (value: unknown): value is typeof NextImage => isComponentLike(value);

/** The module's exports, as the bundler gave them. */
const loaded: unknown = external;

/** Next.js's image component. */
const Image = defaultExport(loaded, isImage, "next/image");

export default Image;

/** Whether a value is `getImageProps`. */
const isGetImageProps = (value: unknown): value is typeof nextGetImageProps => typeof value === "function";

/** Next.js's `getImageProps`: the props of the `<img>` the component would draw. */
export const getImageProps = defaultExport(
  typeof loaded === "object" && loaded !== null ? Reflect.get(loaded, "getImageProps") : undefined,
  isGetImageProps,
  "next/image's getImageProps"
);
