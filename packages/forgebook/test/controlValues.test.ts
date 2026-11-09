/**
 * Tests for the frame's turn of the values of custom controls: which control each arg has, the panel's values into what
 * the story receives, and the story's own into the panel's.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { argControlsOf, controlValuesOf } from "../src/frame/controlValues.ts";
import { UNSET_ARG } from "../src/messages.ts";
import { panelArgTypesOf } from "../src/storyArgTypes.ts";

/** A stand-in for an icon component. */
const IconSearch = (): string => "search";

/** A component's docs as the plugin serves them: two props the catalogue gives its icon picker by type. */
const DOCS = {
  name: "Chip",
  props: [
    { name: "startIcon", customControl: "icon" },
    { name: "endIcon", customControl: "icon" },
    { name: "label" }
  ]
};

/** A story of that component, with no args of its own. */
const story = (
  args: Readonly<Record<string, unknown>> = {},
  argTypes: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {}
): Parameters<typeof controlValuesOf>[2] => ({
  args,
  argTypes,
  loadDocs: async (): Promise<unknown> => DOCS
});

/** A frame module that turns an icon's name into its component, and says what it was told. */
const iconValue = {
  toStoryValue: (value: unknown, argType: { readonly name: string; readonly settings?: unknown }): unknown =>
    value === "IconSearch" ? IconSearch : { value, argType },
  toPanelValue: (value: unknown): string | undefined => (value === IconSearch ? "IconSearch" : undefined)
};

/** The fixture's frame modules. */
const LOADERS = { icon: async (): Promise<unknown> => iconValue };

describe("argControlsOf", () => {
  it("reads the controls by type from the docs, and those the argTypes name", () => {
    const argTypes = panelArgTypesOf({ score: { control: { type: "rating" } } }, []);
    expect(argControlsOf(argTypes, DOCS)).toEqual({ startIcon: "icon", endIcon: "icon", score: "rating" });
  });

  it("lets a control the story's argTypes name win over the one by type", () => {
    const argTypes = panelArgTypesOf(
      { startIcon: { control: "select" }, endIcon: { control: "stars" }, label: { description: "Its text" } },
      []
    );
    expect(argControlsOf(argTypes, DOCS)).toEqual({ endIcon: "stars" });
  });

  it("reads nothing from docs it cannot read", () => {
    expect(argControlsOf({}, undefined)).toEqual({});
    expect(argControlsOf({}, { props: [{ name: 1, customControl: "icon" }, "x"] })).toEqual({});
  });
});

describe("controlValuesOf", () => {
  it("turns each value of a control with a frame module, with the arg and its settings", async () => {
    const made = await controlValuesOf(
      { startIcon: "IconSearch", endIcon: "IconBell", label: "Go" },
      LOADERS,
      {
        ...story({}, { endIcon: { control: { type: "icon", settings: { size: 2 } } } })
      }
    );
    expect(made.values["startIcon"]).toBe(IconSearch);
    expect(made.values["endIcon"]).toEqual({
      value: "IconBell",
      argType: { name: "endIcon", settings: { size: 2 } }
    });
    expect(made.values).not.toHaveProperty("label");
    expect(made).toMatchObject({ dropped: [], problems: [] });
  });

  it("leaves a control without a frame module, and the panel's no value, as they are", async () => {
    const made = await controlValuesOf(
      { score: 3, startIcon: UNSET_ARG },
      LOADERS,
      story({}, { score: { control: { type: "rating" } } })
    );
    expect(made.values).toEqual({ startIcon: undefined });
  });

  it("drops the value of a control whose frame module fails, with a sentence for each way", async () => {
    const made = await controlValuesOf(
      { a: "x", b: "x", c: "x" },
      {
        gone: () => Promise.reject(new Error("404")),
        malformed: async () => ({ toStoryValue: "no" }),
        throwing: async () => ({
          toStoryValue: (): never => {
            throw new Error("bad name");
          }
        })
      },
      story(
        {},
        {
          a: { control: { type: "gone" } },
          b: { control: { type: "malformed" } },
          c: { control: { type: "throwing" } }
        }
      )
    );
    expect(made.values).toEqual({});
    expect(made.dropped).toEqual(["a", "b", "c"]);
    expect(made.problems).toEqual([
      'The control "gone" could not load its frame module: 404',
      'The control "malformed" names a frame module that exports no toStoryValue function',
      'The control "throwing" could not turn the value of "c": bad name'
    ]);
  });

  it("names the story's own values the module knows, whether the panel gives a value or not", async () => {
    const made = await controlValuesOf(
      { endIcon: "IconSearch" },
      LOADERS,
      story({ startIcon: IconSearch, endIcon: IconSearch, label: (): string => "?" })
    );
    expect(made.own).toEqual({ startIcon: "IconSearch", endIcon: "IconSearch" });
    expect(made.values).toEqual({ endIcon: IconSearch });
  });

  it("says once that a module fails, and drops only the values the panel gave", async () => {
    const made = await controlValuesOf(
      { startIcon: "x" },
      { icon: () => Promise.reject(new Error("404")) },
      story()
    );
    expect(made).toMatchObject({
      dropped: ["startIcon"],
      problems: ['The control "icon" could not load its frame module: 404']
    });
  });

  it("reads no loader through the prototype, and does without docs", async () => {
    const made = await controlValuesOf(
      { a: "x" },
      {},
      story({}, { a: { control: { type: "constructor" } } })
    );
    expect(made).toEqual({ values: {}, dropped: [], own: {}, problems: [] });
    const docsless = await controlValuesOf({ startIcon: "IconSearch" }, LOADERS, { args: {}, argTypes: {} });
    expect(docsless.values).toEqual({});
  });
});
