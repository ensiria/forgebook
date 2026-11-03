/**
 * `next/legacy/image` in a catalogue: Next.js's own legacy image component, read as `image.ts` reads the current one.
 *
 * @module
 */

import external from "next/dist/client/legacy/image.js";
import type LegacyImage from "next/legacy/image";

import { defaultExport, isComponentLike } from "./interop.ts";

/** Whether a value is the legacy image component. */
const isLegacyImage = (value: unknown): value is typeof LegacyImage => isComponentLike(value);

/** Next.js's legacy image component. */
const Image = defaultExport(external, isLegacyImage, "next/legacy/image");

export default Image;
