/**
 * The fixture's stories, each drawn on the server: the generated tests, on the HTML renderer.
 *
 * @module
 */
import { htmlRenderer } from "@forgebook/html/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import { source } from "../stories";

storyServerTests(source, { renderer: htmlRenderer });
