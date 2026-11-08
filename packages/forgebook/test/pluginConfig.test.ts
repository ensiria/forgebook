/**
 * Tests for the plugins a configuration lists: the version of the contract, what collides, what they add.
 *
 * @module
 */
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ForgebookPlugin, PluginSwitch } from "../src/plugin.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import {
  pluginFences,
  pluginFrameModule,
  pluginModules,
  pluginsProblem,
  SUPPORTED_PLUGIN_API_VERSIONS,
  withPluginSwitches
} from "../src/vite/pluginConfig.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A plugin that adds nothing. */
const plain: ForgebookPlugin = { apiVersion: 1, id: "acme" };

/** A switch of a plugin. */
const density: PluginSwitch = {
  id: "acme-density",
  label: "Density",
  default: "normal",
  apply: { kind: "code" },
  values: [{ value: "normal", label: "Normal" }]
};

/** The folder of this package, where Node finds what it installs. */
const DIR: string = import.meta.dirname;

/** The problem of a list of plugins in a React catalogue. */
const problemOf = (plugins: readonly ForgebookPlugin[]): string | undefined =>
  pluginsProblem(plugins, "react", DIR);

describe("a plugin's switches", () => {
  it("leave what a value brings to the catalogue", () => {
    const values = JSON.parse('[{ "value": "a", "label": "A", "implies": { "theme": "dark" } }]');
    const plugin: ForgebookPlugin = {
      apiVersion: 1,
      id: "acme",
      switches: [{ id: "look", label: "Look", default: "a", apply: { kind: "code" }, values }]
    };
    expect(pluginsProblem([plugin], "react", DIR)).toContain("those are the catalogue's");
  });
});

describe("the contract's version", () => {
  it("is the first", () => {
    expect(SUPPORTED_PLUGIN_API_VERSIONS).toEqual([1]);
  });

  it("refuses a plugin written for another one, saying both", () => {
    // what a plugin written for a later contract holds: a configuration is not type-checked against this version
    const plugins: ForgebookPlugin[] = JSON.parse('[{ "apiVersion": 2, "id": "later" }]');
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

  it("takes a tab named after its plugin, alone or with a word", () => {
    const tabs = [
      { id: "acme", label: "A", view: "@acme/tab" },
      { id: "acme-more", label: "B", view: "@acme/tab" }
    ];
    expect(problemOf([{ ...plain, tabs }])).toBeUndefined();
  });

  it("refuses a tab that is not named after its plugin, so no later tab of Forgebook's can break it", () => {
    expect(problemOf([{ ...plain, tabs: [{ id: "network", label: "N", view: "@acme/tab" }] }])).toBe(
      'the tab "network" must be "acme", or start with "acme-"'
    );
  });

  it("refuses a tab twice, and a tab that takes one of Forgebook's ids", () => {
    const tab = { id: "acme", label: "A", view: "@acme/tab" };
    expect(problemOf([{ ...plain, tabs: [tab, tab] }])).toBe('the tab "acme" is given twice');
    const named: ForgebookPlugin = { ...plain, id: "code", tabs: [{ ...tab, id: "code" }] };
    expect(problemOf([named])).toBe('the tab "code" is given twice');
  });

  it("names switches and fences the same way, so a fence never takes a language's name", () => {
    expect(problemOf([{ ...plain, switches: [{ ...density, id: "density" }] }])).toBe(
      'the switch "density" must be "acme", or start with "acme-"'
    );
    expect(problemOf([{ ...plain, docBlocks: [{ fence: "ts", view: "@acme/block" }] }])).toBe(
      'the docs block "ts" must be "acme", or start with "acme-"'
    );
  });

  it("refuses a plugin named as a language, whose fence would turn every page's code into its block", () => {
    const ts: ForgebookPlugin = { ...plain, id: "ts", docBlocks: [{ fence: "ts", view: "@acme/block" }] };
    expect(problemOf([ts])).toBe('the docs block "ts" is given twice');
  });

  it("says what is wrong with a plugin read as what it is not", () => {
    const plugins = (text: string): ForgebookPlugin[] => JSON.parse(text);
    expect(problemOf(plugins('[{ "apiVersion": 1, "id": "acme", "tabs": 1 }]'))).toBe(
      'the plugin "acme" gives a list that is no list'
    );
    expect(problemOf(plugins('[{ "apiVersion": 1, "id": "acme", "tabs": [{}] }]'))).toBe(
      'the plugin "acme" adds something with no id'
    );
    expect(problemOf(plugins('[{ "apiVersion": 1, "id": "acme", "frame": null }]'))).toBe(
      'the plugin "acme" names a frame that is no specifier'
    );
  });

  it("refuses a module that is no specifier", () => {
    expect(problemOf([{ ...plain, frame: "" }])).toContain("names a module that is no specifier");
  });

  it("refuses a catalogue of a framework its frame module has no entry for", () => {
    const vue: ForgebookPlugin = { ...plain, frame: { vue: "@acme/frame" } };
    expect(problemOf([vue])).toBe('the plugin "acme" runs in frames of vue, and this catalogue is react');
    expect(pluginsProblem([vue], "vue", DIR)).toBeUndefined();
  });

  it("says what a plugin needs and the project does not install", () => {
    expect(problemOf([{ ...plain, browserDependencies: ["acme-missing/browser"] }])).toBe(
      'the plugin "acme" needs the package acme-missing, which this project does not install'
    );
    expect(problemOf([{ ...plain, browserDependencies: ["vite/client"] }])).toBeUndefined();
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
    const own = { ...density, label: "Mine" };
    expect(withPluginSwitches([own], [{ ...plain, switches: [density] }])).toEqual([own]);
  });

  it("reads a frame module for every framework, or for this one", () => {
    expect(pluginFrameModule({ ...plain, frame: "@acme/frame" }, "react")).toBe("@acme/frame");
    expect(pluginFrameModule({ ...plain, frame: { react: "@acme/r" } }, "react")).toBe("@acme/r");
    expect(pluginFrameModule(plain, "react")).toBeUndefined();
  });

  it("lists the modules the pages import, and the fences a page's compiler reads", () => {
    const plugin: ForgebookPlugin = {
      ...plain,
      frame: "@acme/frame",
      tabs: [{ id: "acme", label: "Acme", view: "@acme/tab" }],
      docBlocks: [{ fence: "acme", view: "@acme/block" }]
    };
    expect(pluginModules([plugin], "react")).toEqual(["@acme/tab", "@acme/block", "@acme/frame"]);
    expect(pluginFences([plugin])).toEqual(["acme"]);
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
      `${resolve("/catalogue", "forgebook.config")}: the plugin "acme" is given twice`
    );
  });

  it("stops at a plugin's switch that takes an address's parameter", () => {
    expect(() =>
      resolveConfig(
        { ...config, plugins: [{ ...plain, id: "story", switches: [{ ...density, id: "story" }] }] },
        "/catalogue"
      )
    ).toThrow("is a parameter of the address");
  });
});
