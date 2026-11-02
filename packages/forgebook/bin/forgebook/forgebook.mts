#!/usr/bin/env node
/**
 * The `forgebook` command's entry: turns on Node's compile cache, starts a first start's pre-bundling, then loads the
 * commands (`forgebookCommands.mts`).
 *
 * @remarks
 * Imports run before any code of the module holding them, so the cache has to be on in a module of its own, or the
 * commands' modules would be compiled before it starts. It sits in Vite's cache folder, so a cold start stays cold, and
 * only where a project has installed something: a command run elsewhere leaves no folder behind.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { enableCompileCache } from "node:module";
import { resolve } from "node:path";

if (existsSync("node_modules")) enableCompileCache(resolve("node_modules/.vite/forgebook/compile"));

// a first start's pre-bundling works while the commands load (`prebundleRun.ts`)
const { prebundleEarly } = await import("./prebundleRun.ts");
prebundleEarly(process.argv.slice(2));

await import("./forgebookCommands.mts");
