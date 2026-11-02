/**
 * Where a frame finds axe's script: Vite serves the file on a dev server, and a build writes it gzipped.
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
 * A build's compressed copy of axe's script: its name, from its text, so a new version of axe is a new file.
 *
 * @remarks
 * axe is most of what a static catalogue weighs, and is fetched only for an accessibility check, so it is kept
 * compressed and the frame unpacks it (`checkStory.ts`). `.bin`, as `.gz` would make some hosts set `Content-Encoding`.
 *
 * @param text - the script's text.
 */
const axeBuildFile = (text: Buffer): string =>
  `assets/axe-${createHash("sha256").update(text).digest("hex").slice(0, 8)}.bin`;

/**
 * How the frame's entry gets axe's address.
 *
 * @param command - whether a dev server runs, or a build.
 * @param packageDir - the core's folder.
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
 * The file a build writes.
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
