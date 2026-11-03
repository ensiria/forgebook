/**
 * The fixture's stories, each drawn on the server: the generated tests, on Preact's renderer.
 *
 * @module
 */
import { preactRenderer } from "@forgebook/preact/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: preactRenderer });
