/**
 * The child that pre-bundles a catalogue's dependencies on a first start (`prebundleRun.ts`), and ends: what rolldown
 * took goes back with it.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { enableCompileCache } from "node:module";
import { resolve } from "node:path";

import { loadConfigFile } from "../../src/vite/configFile.ts";
import { type PrebundleChildData, prebundle } from "./prebundleRun.ts";

if (existsSync("node_modules")) enableCompileCache(resolve("node_modules/.vite/forgebook/compile"));

/** Whether the parent's JSON is what it sends. */
const isChildData = (value: unknown): value is PrebundleChildData =>
  typeof value === "object" &&
  value !== null &&
  "configFile" in value &&
  typeof value.configFile === "string" &&
  "isForced" in value &&
  typeof value.isForced === "boolean";

const data: unknown = JSON.parse(process.argv[2] ?? "null");
if (isChildData(data)) await prebundle(await loadConfigFile(data.configFile), data.isForced);
