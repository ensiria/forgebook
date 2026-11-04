/**
 * The fixture's stories, each drawn on the server: the generated tests, on Angular's renderer.
 *
 * @module
 */
import { angularRenderer } from "@forgebook/angular/renderer";
import { storyServerTests } from "@forgebook/testing/server";

import preview from "../forgebook.preview";
import { source } from "../stories";

storyServerTests(source, { renderer: angularRenderer, previews: [preview] });
