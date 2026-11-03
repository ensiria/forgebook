#!/usr/bin/env node
/**
 * The `forgebook` command's entry: turns on Node's compile cache, starts a first start's pre-bundling
 * (`prebundleStart.ts`), then loads the commands (`forgebookCommands.mts`).
 *
 * @remarks
 * Imports run before any code of the module holding them, so the cache has to be on in a module of its own, or the
 * commands' modules would be compiled before it starts. It sits in the Vite cache folder of the `node_modules` this
 * installation of Forgebook is in (`compileCacheFolder`), never in the folder the command runs from: the code it holds
 * is Forgebook's own, so only the place Forgebook was installed may hold it. Removing that `.vite` folder, as a cold
 * start does, removes it too. Run from its sources, outside any `node_modules`, Forgebook keeps no cache.
 *
 * @module
 */
import { enableCompileCache } from "node:module";

import { compileCacheFolder } from "./compileCache.ts";

const folder = compileCacheFolder(import.meta.dirname);
if (folder !== undefined) enableCompileCache(folder);

// a first start's pre-bundling works while the commands load
const { prebundleEarly } = await import("./prebundleStart.ts");
prebundleEarly(process.argv.slice(2));

await import("./forgebookCommands.mts");
