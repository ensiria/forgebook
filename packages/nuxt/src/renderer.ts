/**
 * The renderer of a Nuxt catalogue, over the project the plugin read: what the frame page draws with, and what the
 * generated server tests take (`storyServerTests(source, { renderer: nuxtRenderer })`).
 *
 * @module
 */

import { project } from "@forgebook/nuxt/project";
import type { StoryRenderer } from "forgebook/renderer";

import { createNuxtRenderer } from "./nuxtRenderer.ts";

/** Vue's renderer, each story given its Nuxt. */
export const nuxtRenderer: StoryRenderer = createNuxtRenderer(project);
