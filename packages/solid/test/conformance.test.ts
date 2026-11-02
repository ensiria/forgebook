/**
 * Solid passing the adapter suite in a page: the definition of done every framework adapter meets. Its server cases run
 * on Node (`conformance.server.test.ts`), with Solid's server build.
 *
 * @module
 */
import { join } from "node:path";

import { describeAdapter } from "@forgebook/testing/conformance";

import { codeOf } from "../src/code.ts";
import { solidRenderer } from "../src/solidRenderer.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";
import { greetingDrawing, sectionDecorator } from "./greeting.tsx";

describeAdapter({
  name: "Solid",
  renderer: solidRenderer,
  drawing: greetingDrawing,
  decorator: sectionDecorator,
  codeOf,
  docsOf: () =>
    extractComponentDocs(join(import.meta.dirname, "..", "fixtures", "docs", "src", "Badge.stories.tsx")),
  cases: "page"
});
