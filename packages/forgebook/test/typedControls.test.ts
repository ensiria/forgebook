/**
 * Tests for the custom controls a catalogue gives props by type or name: which control a prop gets, in what precedence,
 * and that a story's own `argTypes` keep theirs.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { panelProps } from "../src/argTypes.ts";
import type { ComponentDocs, PropDocs } from "../src/componentDocs.ts";
import { storyControlsOf } from "../src/storyControls.ts";
import type { ResolvedArgControls } from "../src/vite/argControlsConfig.ts";
import { matchedControlOf, withTypedControls } from "../src/vite/typedControls.ts";

/** A prop of kind `other`. */
const prop = (name: string, type: string, extra: Partial<PropDocs> = {}): PropDocs => ({
  name,
  kind: "other",
  type,
  description: "",
  isRequired: false,
  ...extra
});

/** The catalogue's controls: an icon picker by type, a picker of one prop by name, and one only stories name. */
const CONTROLS: ResolvedArgControls = {
  icon: { module: "/kit/icon.ts", frame: "/kit/iconValue.ts", matches: [{ typeName: "IconComponent" }] },
  rating: { module: "/app/rating.ts", matches: [] },
  heroIcon: { module: "/app/hero.ts", matches: [{ typeName: "IconComponent", propName: "hero" }] },
  badge: { module: "/kit/badge.ts", matches: [{ propName: "badge" }] }
};

describe("matchedControlOf", () => {
  it("matches a type as written, or through the names the props reader gives", () => {
    expect(matchedControlOf(prop("icon", "IconComponent"), CONTROLS)).toBe("icon");
    // `startIcon?: ButtonIcon` with `type ButtonIcon = IconComponent`
    expect(
      matchedControlOf(
        prop("startIcon", "ButtonIcon", { typeNames: ["ButtonIcon", "IconComponent"] }),
        CONTROLS
      )
    ).toBe("icon");
    // optional, with `undefined` written: the reader leaves it out of the type
    expect(matchedControlOf(prop("endIcon", "IconComponent"), CONTROLS)).toBe("icon");
  });

  it("matches a union only when every member goes by the name", () => {
    expect(
      matchedControlOf(
        prop("either", "IconComponent | ButtonIcon", { typeNames: ["IconComponent"] }),
        CONTROLS
      )
    ).toBe("icon");
    expect(matchedControlOf(prop("either", "IconComponent | ReactNode"), CONTROLS)).toBeUndefined();
  });

  it("matches nothing else, and never an event", () => {
    expect(matchedControlOf(prop("label", "string", { kind: "text" }), CONTROLS)).toBeUndefined();
    expect(matchedControlOf(prop("onIcon", "IconComponent", { kind: "event" }), CONTROLS)).toBeUndefined();
  });

  it("prefers a match by name over one by type, then the first in the catalogue's order", () => {
    expect(matchedControlOf(prop("hero", "IconComponent"), CONTROLS)).toBe("heroIcon");
    expect(matchedControlOf(prop("badge", "ReactNode"), CONTROLS)).toBe("badge");
    const both: ResolvedArgControls = {
      own: { module: "/app/own.ts", matches: [{ typeName: "IconComponent" }] },
      ...CONTROLS
    };
    expect(matchedControlOf(prop("icon", "IconComponent"), both)).toBe("own");
    // a match that names the prop and a type the prop does not have does not fit
    expect(matchedControlOf(prop("hero", "string", { kind: "text" }), CONTROLS)).toBeUndefined();
  });
});

/** A component with two icon props and a label. */
const DOCS: ComponentDocs = {
  name: "Button",
  description: "",
  summary: "",
  props: [
    prop("icon", "IconComponent", { canTakeText: true, shape: { kind: "json" } }),
    prop("label", "string", { kind: "text" })
  ],
  parts: [],
  subcomponents: []
};

describe("withTypedControls", () => {
  it("gives the matching props their control, the shape and the text left to it, and adds no prop", () => {
    const result = withTypedControls({ docs: DOCS, file: "/kit/Button.tsx", sources: [] }, CONTROLS);
    if (typeof result === "string" || !("file" in result)) throw new Error("no docs");
    expect(result.docs.props).toEqual([
      prop("icon", "IconComponent", { customControl: "icon" }),
      DOCS.props[1]
    ]);
  });

  it("makes a choice it matches a prop of its control, which no matrix takes and no token reaches", () => {
    const choice = prop("icon", "IconName", { kind: "choice", choices: ["star", "heart"], token: "icon" });
    const result = withTypedControls(
      { docs: { ...DOCS, props: [choice] }, file: "/kit/Button.tsx", sources: [] },
      { names: { module: "/kit/names.ts", matches: [{ typeName: "IconName" }] } }
    );
    if (typeof result === "string" || !("file" in result)) throw new Error("no docs");
    expect(result.docs.props).toEqual([prop("icon", "IconName", { customControl: "names" })]);
  });

  it("leaves docs without a component, a failure, and a catalogue without matches as they are", () => {
    expect(withTypedControls("it failed", CONTROLS)).toBe("it failed");
    const none = { docs: { name: null } } as const;
    expect(withTypedControls(none, CONTROLS)).toBe(none);
    const plain = { docs: DOCS, file: "/kit/Button.tsx", sources: [] };
    expect(withTypedControls(plain, { rating: { module: "/r.ts", matches: [] } })).toBe(plain);
  });
});

describe("a typed control in a story", () => {
  const typed = [
    prop("icon", "IconComponent", { customControl: "icon" }),
    prop("label", "string", { kind: "text" })
  ];

  it("is the prop's control in a story that names none", () => {
    expect(panelProps(typed, {})[0]?.customControl).toBe("icon");
    expect(panelProps(typed, { icon: { isHidden: false, description: "Its icon" } })[0]?.customControl).toBe(
      "icon"
    );
  });

  it("gives way to a control the story's argTypes name", () => {
    const select = panelProps(typed, { icon: { isHidden: false, control: "select", options: ["a"] } })[0];
    expect(select?.customControl).toBeUndefined();
    expect(select?.control).toBe("select");
    const rating = panelProps(typed, { icon: { isHidden: false, customControl: "rating" } })[0];
    expect(rating?.customControl).toBe("rating");
  });

  it("reaches agents as a custom control, with its schema", () => {
    const controls = storyControlsOf({
      props: typed,
      argTypes: {},
      controls: "all",
      storyArgs: {},
      namedValues: {},
      customSchemas: { icon: { type: "string", enum: ["IconSearch"] } }
    });
    expect(controls[0]).toMatchObject({
      name: "icon",
      control: "custom",
      custom: "icon",
      schema: { type: "string", enum: ["IconSearch"] }
    });
  });
});
