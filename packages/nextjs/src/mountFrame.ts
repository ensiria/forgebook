/**
 * The frame page of a Next.js catalogue: Forgebook's frame, drawing its stories with React and Next.js's route,
 * request and server components. Called by the page the plugin generates from the catalogue's configuration.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { nextRenderer } from "./nextRenderer.tsx";

/**
 * Shows the story the address names in the given element, drawn with React for a Next.js project.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: nextRenderer });
