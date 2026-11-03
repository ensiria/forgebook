/**
 * The frame page of a Web Components catalogue: Forgebook's frame, drawing its stories with Lit. Called by the page the
 * plugin generates from the catalogue's configuration, not by an app.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { webComponentsRenderer } from "./webComponentsRenderer.ts";

/**
 * Shows the story the address names in the given element, drawn with Lit.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: webComponentsRenderer });
