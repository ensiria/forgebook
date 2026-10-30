/**
 * The stub framework the core's tests give the plugin and the docs' extractor (`stubDocs.ts`).
 *
 * @module
 */
import type { FrameworkAdapter } from "../../src/vite/adapter.ts";

/** A framework whose docs module names each component after its story file. */
export const STUB_FRAMEWORK: FrameworkAdapter = {
  name: "stub",
  docsModule: new URL("./stubDocs.ts", import.meta.url).href
};
