/**
 * The fixture's stories, each drawn on the server: the generated tests, on Vue's renderer.
 *
 * @module
 */
import { storyServerTests } from "@forgebook/testing/server";
import { vueRenderer } from "@forgebook/vue/renderer";

import { source } from "../stories";

storyServerTests(source, { renderer: vueRenderer });
