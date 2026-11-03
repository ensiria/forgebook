/**
 * The fixture's stories, each drawn on the server: the generated tests, on Svelte's renderer, in Node where the
 * components are compiled for the server.
 *
 * @module
 */
import { svelteRenderer } from "@forgebook/svelte/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: svelteRenderer });
