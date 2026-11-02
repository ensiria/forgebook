/**
 * The MSW plugin: a story's API answered by its `parameters.msw`, and a Network tab with its handlers and its requests.
 *
 * @remarks
 * Plain data, loaded with the catalogue's configuration. Its frame module is small and loads with every story; MSW itself
 * loads only for a story with handlers.
 *
 * @module
 */
import { definePlugin, type ForgebookPlugin, PLUGIN_API_VERSION } from "forgebook/plugin";

/**
 * The plugin, for a catalogue's `plugins`.
 *
 * @returns the plugin.
 */
export const msw = (): ForgebookPlugin =>
  definePlugin({
    apiVersion: PLUGIN_API_VERSION,
    id: "msw",
    frame: "@forgebook/plugin-msw/frame",
    tabs: [
      {
        id: "network",
        label: "Network",
        view: "@forgebook/plugin-msw/tab",
        when: { parameter: "msw" }
      }
    ],
    browserDependencies: ["msw/browser"]
  });
