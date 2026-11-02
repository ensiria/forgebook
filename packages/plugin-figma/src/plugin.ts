/**
 * The Figma plugin: a story's design in the panel, embedded from Figma and beside the story, and a design in a docs page.
 *
 * @remarks
 * Plain data, loaded with the catalogue's configuration: the tab's code and Figma's viewer load only when the tab opens.
 * A story names its design with `parameters.design.figma`, which Forgebook reads and checks on its own, with or without
 * this plugin: the link, its "Open in Figma" button and the agents' answers stay; this adds the tab.
 *
 * @module
 */
import { definePlugin, type ForgebookPlugin } from "forgebook/plugin";

/**
 * The plugin, for a catalogue's `plugins`.
 *
 * @returns the plugin.
 */
export const figma = (): ForgebookPlugin =>
  definePlugin({
    apiVersion: 1,
    id: "figma",
    tabs: [{ id: "figma", label: "Design", view: "@forgebook/plugin-figma/tab", when: { design: "figma" } }],
    docBlocks: [{ fence: "figma", view: "@forgebook/plugin-figma/block" }]
  });
