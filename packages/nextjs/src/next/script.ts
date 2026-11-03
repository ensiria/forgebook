/**
 * `next/script` in a catalogue: Next.js's own `Script`, read as `image.ts` reads the image component. Its strategies
 * load the script in the story's frame as they do in the app's page.
 *
 * @module
 */

import external from "next/dist/client/script.js";
import type NextScript from "next/script";

import { defaultExport, isComponentLike } from "./interop.ts";

/** Whether a value is the script component. */
const isScript = (value: unknown): value is typeof NextScript => isComponentLike(value);

/** Next.js's `Script`. */
const Script = defaultExport(external, isScript, "next/script");

export default Script;
