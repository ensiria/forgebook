/**
 * A plugin that touches every place the plugin API offers, so the shell's tests hold the contract itself: a tab that
 * reads its frame module's report, a tab that cannot load, a switch and a decorator. Only a story with
 * `parameters.probe` sees any of it.
 *
 * @module
 */
import { definePlugin, type ForgebookPlugin, PLUGIN_API_VERSION } from "forgebook/plugin";

/**
 * The plugin.
 *
 * @returns the plugin, for the fixture catalogue's `plugins`.
 */
export const probePlugin = (): ForgebookPlugin =>
  definePlugin({
    apiVersion: PLUGIN_API_VERSION,
    id: "probe",
    frame: "@fixture/storybook/plugin/frame",
    frameworks: ["react"],
    tabs: [
      { id: "probe", label: "Probe", view: "@fixture/storybook/plugin/tab", when: { parameter: "probe" } },
      {
        id: "probe-broken",
        label: "Broken probe",
        view: "@fixture/storybook/plugin/broken-tab",
        when: { parameter: "probe" }
      }
    ],
    switches: [
      {
        id: "probe",
        label: "Probe",
        default: "calm",
        apply: { kind: "code" },
        values: [
          { value: "calm", label: "Calm" },
          { value: "loud", label: "Loud" }
        ]
      }
    ],
    docBlocks: [{ fence: "probe", view: "@fixture/storybook/plugin/tab" }]
  });
