/**
 * The frame page of a SvelteKit catalogue: Forgebook's frame, drawing its stories with Svelte and each story's
 * SvelteKit page. Called by the page the plugin generates from the catalogue's configuration.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { kitRenderer } from "./kitRenderer.ts";

/**
 * Shows the story the address names in the given element, drawn with Svelte for a SvelteKit project.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: kitRenderer });
