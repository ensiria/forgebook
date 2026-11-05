/**
 * The fixture's stories, each drawn on the server: the generated tests, on Next.js's renderer, in Node, where a server
 * component is awaited and its `fetch` answered by the story's mocks.
 *
 * @module
 */
import { nextRenderer } from "@forgebook/nextjs/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: nextRenderer });
