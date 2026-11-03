/**
 * The frame page of a Preact catalogue: Forgebook's frame, drawing its stories with Preact. Called by the page the
 * plugin generates from the catalogue's configuration, not by an app.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { preactRenderer } from "./preactRenderer.tsx";

/**
 * Shows the story the address names in the given element, drawn with Preact.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: preactRenderer });
