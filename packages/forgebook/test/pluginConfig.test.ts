/**
 * Tests for the plugins a configuration lists: the version of the contract, what collides, what they add.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type ForgebookPlugin, PLUGIN_API_VERSION } from "../src/plugin.ts";
import { DEFAULT_SWITCHES, type ViewSwitch } from "../src/switches.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import { pluginModules, pluginsProblem, withPluginSwitches } from "../src/vite/pluginConfig.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A plugin that adds nothing. */
const plain: ForgebookPlugin = { apiVersion: PLUGIN_API_VERSION, id: "acme" };

/** A switch of a plugin. */
const density: ViewSwitch = {
  id: "density",
  label: "Density",
  default: "normal",
  apply: { kind: "code" },
  values: [{ value: "normal", label: "Normal" }]
};

/** The problem of a list of plugins in a React catalogue. */
const problemOf = (plugins: readonly ForgebookPlugin[]): string | undefined =>
  pluginsProblem(plugins, "react");

describe("the contract's version", () => {
  it("is the first", () => {
    expect(PLUGIN_API_VERSION).toBe(1);
  });

  it("refuses a plugin written for another one, saying both", () => {
    // what a plugin written for a later contract holds: a configuration is not type-checked against this version
    const later: unknown = { apiVersion: 2, id: "later" };
    const plugins: ForgebookPlugin[] = JSON.parse(JSON.stringify([later]));
    expect(problemOf(plugins)).toBe(
      'the plugin "later" is written for version 2 of the plugin API, and this Forgebook speaks version 1: update one of them'
    );
  });
});

describe("a list of plugins", () => {
  it("is fine with nothing in it", () => {
    expect(problemOf([])).toBeUndefined();
  });

  it("refuses an id that could not name its texts, and the same id twice", () => {
    expect(problemOf([{ ...plain, id: "@acme/plugin" }])).toContain("lower-case words and hyphens");
    expect(problemOf([plain, plain])).toBe('the plugin "acme" is given twice');
  });

  it("refuses a tab that takes one of Forgebook's ids, or another plugin's", () => {
    const tab = { id: "code", label: "Mine", view: "@acme/tab" };
    expect(problemOf([{ ...plain, tabs: [tab] }])).toBe('the tab "code" is Forgebook\'s own');
    const shared = { ...tab, id: "shared" };
    expect(
      problemOf([
        { ...plain, tabs: [shared] },
        { ...plain, id: "other", tabs: [shared] }
      ])
    ).toBe('the tab "shared" is given twice');
  });

  it("refuses a block named as a page's own, or as another's", () => {
    const block = { fence: "story", view: "@acme/block" };
    expect(problemOf([{ ...plain, docBlocks: [block] }])).toBe('the docs block "story" is Forgebook\'s own');
    const shared = { ...block, fence: "chart" };
    expect(problemOf([{ ...plain, docBlocks: [shared, shared] }])).toBe(
      'the docs block "chart" is given twice'
    );
  });

  it("refuses a module that is no specifier", () => {
    expect(problemOf([{ ...plain, frame: "" }])).toContain("names a module that is no specifier");
  });

  it("refuses a frame module for another framework, and only that", () => {
    const vue: ForgebookPlugin = { ...plain, frame: "@acme/frame", frameworks: ["vue"] };
    expect(problemOf([vue])).toBe('the plugin "acme" runs in frames of vue, and this catalogue is react');
    expect(pluginsProblem([vue], "vue")).toBeUndefined();
    expect(problemOf([{ ...plain, frameworks: ["vue"] }])).toBeUndefined();
  });
});

describe("what plugins add", () => {
  it("adds their switches after the default ones, which stay", () => {
    expect(withPluginSwitches(undefined, [{ ...plain, switches: [density] }])).toEqual([
      ...DEFAULT_SWITCHES,
      density
    ]);
  });

  it("leaves a catalogue that declares no switch as it was, when they add none", () => {
    expect(withPluginSwitches(undefined, [plain])).toBeUndefined();
  });

  it("lets the catalogue's own switch of the same id win", () => {
    const own: ViewSwitch = { ...density, label: "Mine" };
    expect(withPluginSwitches([own], [{ ...plain, switches: [density] }])).toEqual([own]);
  });

  it("lists the modules the pages import", () => {
    expect(
      pluginModules([
        {
          ...plain,
          frame: "@acme/frame",
          tabs: [{ id: "acme", label: "Acme", view: "@acme/tab" }]
        }
      ])
    ).toEqual(["@acme/tab", "@acme/frame"]);
  });
});

describe("a configuration with plugins", () => {
  const config = { framework: STUB_FRAMEWORK, title: "Acme", stories: ["src/*.stories.tsx"] };

  it("keeps them, in order", () => {
    expect(resolveConfig({ ...config, plugins: [plain] }, "/catalogue").plugins).toEqual([plain]);
    expect(resolveConfig(config, "/catalogue").plugins).toEqual([]);
  });

  it("stops at a problem, naming the configuration", () => {
    expect(() => resolveConfig({ ...config, plugins: [plain, plain] }, "/catalogue")).toThrow(
      '/catalogue/forgebook.config: the plugin "acme" is given twice'
    );
  });

  it("stops at a plugin's switch that takes an address's parameter", () => {
    expect(() =>
      resolveConfig(
        { ...config, plugins: [{ ...plain, switches: [{ ...density, id: "story" }] }] },
        "/catalogue"
      )
    ).toThrow("is a parameter of the address");
  });
});
