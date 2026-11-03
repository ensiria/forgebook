/**
 * The fixture's stories, each drawn on the server: the generated tests, on the Nuxt renderer.
 *
 * @module
 */
import { nuxtRenderer } from "@forgebook/nuxt/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: nuxtRenderer });
