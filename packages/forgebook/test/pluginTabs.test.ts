/**
 * Tests for which plugin tabs a story shows, decided from data, without loading a view.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { PluginStory, PluginTabContext, PluginView } from "../src/plugin.ts";
import { pluginTabsFor, type ShellPlugin } from "../src/shell/pluginTabs.tsx";

/** A view load that must not run. */
const noLoad = (): Promise<{ readonly view: PluginView<PluginTabContext> }> => {
  throw new Error("A tab was loaded to decide whether it shows");
};

/** A story without a design. */
const STORY: PluginStory = {
  id: "kit:a--b",
  name: "B",
  title: "Kit/A",
  componentName: "A",
  isLogic: false,
  design: undefined
};

/** The same with one. */
const DESIGNED: PluginStory = {
  ...STORY,
  design: { url: "https://www.figma.com/design/F/K", kind: "design", fileKey: "F" }
};

/** One plugin with one tab for a parameter, and one for every story. */
const PLUGINS: readonly ShellPlugin[] = [
  {
    id: "acme",
    tabs: [
      { id: "always", label: "Always", when: undefined, load: noLoad },
      { id: "mocks", label: "Mocks", when: { parameter: "msw" }, load: noLoad },
      { id: "design", label: "Design", when: { parameter: "design" }, load: noLoad }
    ]
  }
];

/** What the tabs are built from, with nothing reported. */
const INPUT = {
  plugins: PLUGINS,
  strings: {},
  story: STORY,
  parameters: [],
  reports: new Map(),
  isComparing: false,
  aside: { address: "/frame.html", width: "fill", background: undefined, args: {}, view: undefined }
} as const;

/** The ids of the tabs shown. */
const shown = (input: Parameters<typeof pluginTabsFor>[0]): string[] =>
  pluginTabsFor(input).map((tab) => tab.id);

describe("pluginTabsFor", () => {
  it("shows nothing without a plugin", () => {
    expect(shown({ ...INPUT, plugins: [] })).toEqual([]);
  });

  it("offers a tab with no condition for every story", () => {
    expect(shown(INPUT)).toEqual(["always"]);
  });

  it("offers a tab for a parameter once the frame says the story has it", () => {
    expect(shown({ ...INPUT, parameters: ["msw"] })).toEqual(["always", "mocks"]);
  });

  it("knows a design before any frame ran, from the index", () => {
    expect(shown({ ...INPUT, story: DESIGNED })).toEqual(["always", "design"]);
  });

  it("names a tab as the catalogue replaces it, and notes what its plugin reported", () => {
    const [tab] = pluginTabsFor({
      ...INPUT,
      strings: { "tabs.always": "Toujours" },
      reports: new Map([["kit:a--b|acme", { value: 1, hint: "3" }]])
    });
    expect(tab?.label).toBe("Toujours");
    expect(tab?.hint).toBe("3");
  });

  it("notes nothing in the compare view, where no frame is the story's", () => {
    const [tab] = pluginTabsFor({
      ...INPUT,
      isComparing: true,
      reports: new Map([["kit:a--b|acme", { value: 1, hint: "3" }]])
    });
    expect(tab?.hint).toBeUndefined();
  });

  it("keeps another story's report to itself", () => {
    const [tab] = pluginTabsFor({
      ...INPUT,
      reports: new Map([["kit:other|acme", { value: 1, hint: "3" }]])
    });
    expect(tab?.hint).toBeUndefined();
  });
});
