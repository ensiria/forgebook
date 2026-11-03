/**
 * The child that pre-bundles a catalogue's dependencies on a first start (`prebundleStart.ts`), and ends: what
 * rolldown took goes back with it. Its exit code tells the server whether the work is done.
 *
 * @module
 */
import { enableCompileCache } from "node:module";

import { loadConfigFile } from "../../src/vite/configFile.ts";
import { FRAMES_MODES, withFramePort, withFramesMode } from "./catalogueVite.ts";
import { compileCacheFolder } from "./compileCache.ts";
import { prebundle } from "./prebundleRun.ts";
import type { PrebundleChildData } from "./prebundleStart.ts";

const folder = compileCacheFolder(import.meta.dirname);
if (folder !== undefined) enableCompileCache(folder);

/**
 * Whether the parent's JSON is what it sends.
 *
 * @param value - the JSON, parsed.
 */
const isChildData = (value: unknown): value is PrebundleChildData =>
  typeof value === "object" &&
  value !== null &&
  "configFile" in value &&
  typeof value.configFile === "string" &&
  "isForced" in value &&
  typeof value.isForced === "boolean" &&
  (!("frames" in value) || FRAMES_MODES.some((mode) => mode === value.frames)) &&
  (!("framePort" in value) || typeof value.framePort === "string");

const data: unknown = JSON.parse(process.argv[2] ?? "null");
if (!isChildData(data)) throw new Error("The pre-bundling child was started without what it needs");
const config = withFramePort(
  withFramesMode(await loadConfigFile(data.configFile), data.frames),
  data.framePort
);
await prebundle(config, data.isForced);
// done: a handle a plugin left open would keep the server waiting for this process
process.exit(0);
