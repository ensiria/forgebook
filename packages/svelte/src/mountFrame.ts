/**
 * The frame page of a Svelte catalogue: Forgebook's frame, drawing its stories with Svelte. Called by the page the plugin
 * generates from the catalogue's configuration, not by an app.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { svelteRenderer } from "./svelteRenderer.ts";

/**
 * Shows the story the address names in the given element, drawn with Svelte.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: svelteRenderer });
