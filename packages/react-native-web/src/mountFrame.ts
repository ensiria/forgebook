/**
 * The frame page of a React Native catalogue: Forgebook's frame, drawing its stories with React through
 * react-native-web, each in a root laid out as React Native's. Called by the page the plugin generates from the
 * catalogue's configuration, not by an app.
 *
 * @module
 */
import { type FrameConfig, mountFrame as mountForgebookFrame } from "forgebook/frame";

import { nativeRenderer } from "./nativeRenderer.ts";

/**
 * Shows the story the address names in the given element, drawn with React Native's components.
 *
 * @param container - the element the story renders into.
 * @param config - the sources and the languages, as the shell's configuration gives them.
 */
export const mountFrame = (container: HTMLElement, config: Omit<FrameConfig, "renderer">): Promise<void> =>
  mountForgebookFrame(container, { ...config, renderer: nativeRenderer });
