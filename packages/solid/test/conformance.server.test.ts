/**
 * Solid passing the adapter suite's server cases, on Node with Solid's server build: what the generated server tests
 * rely on.
 *
 * @module
 */
import { describeAdapter } from "@forgebook/testing/conformance";

import { codeOf } from "../src/code.ts";
import { solidRenderer } from "../src/solidRenderer.ts";
import { greetingDrawing, sectionDecorator } from "./greeting.tsx";

describeAdapter({
  name: "Solid on a server",
  renderer: solidRenderer,
  drawing: greetingDrawing,
  decorator: sectionDecorator,
  codeOf,
  half: "server"
});
