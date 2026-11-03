/**
 * The frame page of an HTML catalogue: Forgebook's frame, drawing its stories' HTML strings and DOM nodes. Called by the
 * page the plugin generates from the catalogue's configuration, not by an app.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { htmlRenderer } from "./htmlRenderer.ts";

/**
 * Shows the story the address names in the given element, drawn as HTML.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: htmlRenderer });
