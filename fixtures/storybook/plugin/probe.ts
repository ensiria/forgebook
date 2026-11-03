/**
 * A plugin that touches every place the plugin API offers, so the shell's tests hold the contract itself: a tab that
 * reads its frame module's report, a tab that cannot load, a switch, a decorator and a docs block that draws a story. Only a story with
 * `parameters.probe` sees any of it.
 *
 * @module
 */
import { definePlugin, type ForgebookPlugin } from "forgebook/plugin";

/**
 * The plugin.
 *
 * @returns the plugin, for the fixture catalogue's `plugins`.
 */
export const probePlugin = (): ForgebookPlugin =>
  definePlugin({
    apiVersion: 1,
    id: "probe",
    frame: { react: "@fixture/storybook/plugin/frame" },
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
    docBlocks: [{ fence: "probe", view: "@fixture/storybook/plugin/block" }]
  });
