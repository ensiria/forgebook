/**
 * Where a frame finds axe's script, for the Accessibility card: Vite serves the file on a dev server, and a build
 * writes it gzipped.
 *
 * @remarks
 * axe is a minified file already, more than half a megabyte, for a card most visits never open. Loaded as a module it
 * would pass through Vite's pre-bundling on every cold start and through the minifier on every build; loaded as a
 * script it does neither (`checkStory.ts`). A build keeps it gzipped, since it would otherwise be close to half of what
 * a static catalogue weighs, and the frame unpacks it when asked.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { packageResolver } from "./configFile.ts";
import type { AxeAddress } from "./pages.ts";

/**
 * axe's script, in the core's dependencies; none when it cannot be found.
 *
 * @param packageDir - the core's folder.
 */
const axeScript = (packageDir: string): string | undefined =>
  packageResolver(packageDir)("axe-core/axe.min.js");

/**
 * A build's compressed copy of axe's script: its name, from its text, so a new version of axe is a new file. `.bin`,
 * since `.gz` makes some hosts send it with `Content-Encoding: gzip`, which the browser would unpack before the frame.
 *
 * @param text - the script's text.
 */
const axeBuildFile = (text: Buffer): string =>
  `assets/axe-${createHash("sha256").update(text).digest("hex").slice(0, 8)}.bin`;

/**
 * How the frame's entry gets axe's address: a `?url` import on a dev server, the build's file under the base in a
 * build.
 *
 * @param command - whether a dev server runs, or a build.
 * @param packageDir - the core's folder.
 * @returns the address, or none when axe cannot be found.
 */
export const axeAddress = (command: "serve" | "build", packageDir: string): AxeAddress | undefined => {
  const file = axeScript(packageDir);
  if (file === undefined) return undefined;
  if (command === "serve")
    return { imports: [`import axeUrl from ${JSON.stringify(`${file}?url`)};`], value: "axeUrl" };
  const name = axeBuildFile(readFileSync(file));
  return { imports: [], value: `import.meta.env.BASE_URL + ${JSON.stringify(name)}` };
};

/**
 * The file a build writes: axe's script, gzipped.
 *
 * @param packageDir - the core's folder.
 * @returns its name and bytes; none when axe cannot be found.
 */
export const axeBuildAsset = (
  packageDir: string
): { readonly fileName: string; readonly source: Buffer } | undefined => {
  const file = axeScript(packageDir);
  if (file === undefined) return undefined;
  const text = readFileSync(file);
  return { fileName: axeBuildFile(text), source: gzipSync(text, { level: 9 }) };
};
