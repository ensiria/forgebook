/**
 * The fixture's stories, each drawn on the server: the generated tests, on the Web Components renderer.
 *
 * @module
 */
import { storyServerTests } from "@forgebook/testing/server";
import { webComponentsRenderer } from "@forgebook/web-components/renderer";

import { source } from "../stories";

storyServerTests(source, { renderer: webComponentsRenderer });
