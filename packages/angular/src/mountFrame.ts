/**
 * The frame page of an Angular catalogue: Forgebook's frame, drawing its stories with Angular. Called by the page the
 * plugin generates from the catalogue's configuration, not by an app.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { angularRenderer } from "./angularRenderer.ts";

/**
 * Shows the story the address names in the given element, drawn with Angular.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: angularRenderer });
