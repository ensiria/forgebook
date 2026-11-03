/**
 * Tests for a story's `argTypes`: read from the meta and the story, sent to the shell, laid over the props the types
 * give, and their `mapping` applied to the args.
 *
 * @module
 */
import { describe, expect, it, vi } from "vitest";

import {
  actionNames,
  controlsOfParameter,
  excludedControls,
  mappedArgs,
  mergedArgTypes,
  panelArgTypesOf,
  panelProps
} from "../src/argTypes.ts";
import type { PropDocs } from "../src/componentDocs.ts";

/** The props the types of a button give. */
const PROPS: readonly PropDocs[] = [
  {
    name: "tone",
    kind: "choice",
    type: '"neutral" | "danger"',
    description: "The tone.",
    isRequired: false,
    choices: ["neutral", "danger"]
  },
  { name: "label", kind: "text", type: "string", description: "The text.", isRequired: true },
  {
    name: "icon",
    kind: "other",
    type: "ReactNode",
    description: "An icon.",
    isRequired: false,
    canTakeText: true
  },
  { name: "onPress", kind: "event", type: "() => void", description: "", isRequired: false }
];

describe("panelProps", () => {
  it("leaves the props exactly as the types give them when the story has no argTypes", () => {
    expect(panelProps(PROPS, {})).toEqual(PROPS);
  });

  it("lays a control, options, labels, a name and a description over a prop", () => {
    const argTypes = panelArgTypesOf(
      mergedArgTypes(
        { tone: { control: "select", description: "Meta's." } },
        {
          tone: {
            name: "Tone",
            description: "How loud.",
            control: { type: "inline-radio", labels: { danger: "Danger!" } }
          }
        }
      ),
      []
    );
    const [tone] = panelProps(PROPS, argTypes);
    expect(tone).toMatchObject({
      name: "tone",
      label: "Tone",
      kind: "choice",
      control: "radio",
      description: "How loud.",
      labels: { danger: "Danger!" },
      choices: ["neutral", "danger"]
    });
  });

  it("hides what table.disable and controls.exclude name, and lists an object control for reading", () => {
    const argTypes = panelArgTypesOf(
      { label: { table: { disable: true } }, icon: { control: "object" } },
      excludedControls({ exclude: ["tone"] })
    );
    const props = panelProps(PROPS, argTypes);
    expect(props.map((prop) => prop.name)).toEqual(["icon", "onPress"]);
    expect(props[0]).toMatchObject({ kind: "other", control: "none" });
    expect(props[0]).not.toHaveProperty("canTakeText");
  });

  it("adds the args only the argTypes name, as a story without a typed component has", () => {
    const argTypes = panelArgTypesOf(
      {
        size: { options: ["s", "m"] },
        volume: { control: { type: "range", min: 0, max: 10, step: 2 } },
        sides: { control: "check", options: ["top", "end", 3, { not: "sent" }] },
        at: { control: "date" }
      },
      []
    );
    expect(panelProps([], argTypes)).toEqual([
      {
        name: "size",
        kind: "choice",
        type: "",
        description: "",
        isRequired: false,
        control: "select",
        choices: ["s", "m"]
      },
      {
        name: "volume",
        kind: "number",
        type: "",
        description: "",
        isRequired: false,
        control: "range",
        min: 0,
        max: 10,
        step: 2
      },
      {
        name: "sides",
        kind: "choice",
        type: "",
        description: "",
        isRequired: false,
        control: "check",
        choices: ["top", "end", 3]
      },
      { name: "at", kind: "number", type: "", description: "", isRequired: false, control: "date" }
    ]);
  });
});

describe("mappedArgs", () => {
  it("turns a mapping's key into its value, in the story's args or the panel's, and leaves the rest", () => {
    const bold = { weight: 700 };
    const argTypes = { icon: { options: ["bold"], mapping: { bold } } };
    expect(mappedArgs({ icon: "bold", label: "Go" }, argTypes)).toEqual({ icon: bold, label: "Go" });
    expect(mappedArgs({ icon: "italic" }, argTypes)).toEqual({ icon: "italic" });
  });

  it("looks a key up among the mapping's own only, never its prototype's", () => {
    const argTypes = { icon: { mapping: { bold: 1 } } };
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(mappedArgs({ icon: key }, argTypes)).toEqual({ icon: key });
    }
  });
});

describe("the controls parameter", () => {
  it("reads false, a list, Storybook's include, and every prop otherwise", () => {
    expect(controlsOfParameter(false)).toEqual([]);
    expect(controlsOfParameter(["size"])).toEqual(["size"]);
    expect(controlsOfParameter({ include: ["tone"], exclude: ["x"] })).toEqual(["tone"]);
    expect(controlsOfParameter({ expanded: true })).toBe("all");
    expect(excludedControls({ exclude: ["x", 1] })).toEqual(["x"]);
  });
});

describe("actionNames", () => {
  it("records spies and the args argTypes name an action for, never an arg for its name alone", () => {
    const args = { onPress: vi.fn(), onHover: (): void => undefined, label: "Go" };
    expect(actionNames(args, { onClose: { action: "closed" }, onOpen: { control: false } })).toEqual([
      "onPress",
      "onClose"
    ]);
  });
});
