/**
 * The fixture's stories, each drawn on the server: the generated tests, on Solid's renderer and its server build.
 *
 * @module
 */
import { solidRenderer } from "@forgebook/solid/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: solidRenderer });
