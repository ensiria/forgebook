/**
 * The fixture's stories, each drawn on the server: the generated tests, on SvelteKit's renderer, in Node where the
 * components are compiled for the server and a page's load runs before it is drawn.
 *
 * @module
 */
import { kitRenderer } from "@forgebook/sveltekit/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: kitRenderer });
