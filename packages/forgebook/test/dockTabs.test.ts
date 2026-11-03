/**
 * Tests for the tabs of a story's panel: a story about logic shows its hook's signature first and none of the tabs
 * that set or read args, which its scene does not take.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ComponentDocs } from "../src/componentDocs.ts";
import type { DesignTabProps } from "../src/shell/DesignTab.tsx";
import { type DockTabsInput, dockTabs } from "../src/shell/dockTabs.tsx";

/** A hook whose options carry a value and a callback, so a component would get Props and Events. */
const HOOK_DOCS: ComponentDocs = {
  name: "useForm",
  description: "",
  summary: "",
  props: [
    { name: "initial", kind: "text", type: "string", description: "", isRequired: false },
    { name: "onChange", kind: "event", type: "() => void", description: "", isRequired: false }
  ],
  parts: [],
  subcomponents: [],
  signature: {
    typeParameters: [],
    parameters: [{ name: "options", type: "FormOptions", description: "", isOptional: false, isRest: false }],
    returns: "FormState",
    returnsDescription: ""
  }
};

/** A story's design, for the Design tab. */
const DESIGN: DesignTabProps = {
  link: { url: "https://www.figma.com/design/File1/Kit", kind: "design", fileKey: "File1" },
  title: "Select › Small",
  frame: {
    address: "/frame.html?story=a",
    width: "fill",
    background: undefined,
    args: {},
    view: undefined
  }
};

/**
 * The input of a story's panel.
 *
 * @param isLogic - whether the story is about logic.
 */
const inputOf = (isLogic: boolean): DockTabsInput => ({
  docs: { status: "ready", value: HOOK_DOCS },
  code: { status: "none" },
  exportName: "Filled",
  isLogic,
  componentName: "useForm",
  controls: "all",
  argTypes: {},
  actions: [],
  values: {},
  onValueChange: (): undefined => undefined,
  onReset: (): undefined => undefined,
  worstCase: {
    canApply: false,
    isOn: false,
    spillCount: undefined,
    onApply: (): undefined => undefined
  },
  namedValues: undefined,
  textArgs: {},
  propGroups: [],
  calls: [],
  onClearCalls: (): undefined => undefined,
  trace: undefined,
  onPlayAgain: (): undefined => undefined,
  check: { status: "idle" },
  onCheck: undefined,
  design: undefined
});

describe("the tabs of a story's panel", () => {
  it("opens a story about logic on the signature, without the tabs of args it does not take", () => {
    expect(dockTabs(inputOf(true)).map((tab) => tab.id)).toEqual(["signature", "a11y"]);
  });

  it("names the tab of a story about logic Signature while its docs load or fail", () => {
    const loading = dockTabs({ ...inputOf(true), docs: { status: "loading" } });
    expect(loading.map((tab) => [tab.id, tab.label])).toEqual([
      ["signature", "Signature"],
      ["a11y", "Accessibility"]
    ]);
    const failed = dockTabs({ ...inputOf(true), docs: { status: "error", message: "no program" } });
    expect(failed[0]?.id).toBe("signature");
  });

  it("gives a story about its looks its props and events, and no signature", () => {
    expect(dockTabs(inputOf(false)).map((tab) => tab.id)).toEqual(["props", "events", "a11y"]);
  });

  it("shows Events for a story with no events of its own once a framework reported a call", () => {
    const input: DockTabsInput = {
      ...inputOf(false),
      docs: { status: "ready", value: { ...HOOK_DOCS, props: [] } }
    };
    expect(dockTabs(input).map((tab) => tab.id)).not.toContain("events");
    const withCall = dockTabs({
      ...input,
      calls: [{ storyId: "s", name: "router.push", values: ["/about"], details: [null], time: 0 }]
    });
    expect(withCall.map((tab) => tab.id)).toContain("events");
  });

  it("offers the Design tab only to a story with a design, a story about logic too", () => {
    expect(dockTabs({ ...inputOf(false), design: DESIGN }).map((tab) => tab.id)).toEqual([
      "props",
      "events",
      "design",
      "a11y"
    ]);
    expect(dockTabs({ ...inputOf(true), design: DESIGN }).map((tab) => tab.id)).toEqual([
      "signature",
      "design",
      "a11y"
    ]);
  });

  it("keeps the Code tab's place while the story file's code loads, so the panel opens on it, not on Design", () => {
    const withoutComponent: DockTabsInput = { ...inputOf(false), docs: { status: "none" }, design: DESIGN };
    const loading = dockTabs({ ...withoutComponent, code: { status: "loading" } });
    expect(loading.map((tab) => [tab.id, tab.label])).toEqual([
      ["code", "Code"],
      ["design", "Design"],
      ["a11y", "Accessibility"]
    ]);
    const loaded = dockTabs({ ...withoutComponent, code: { status: "ready", value: {} } });
    expect(loaded[0]?.id).toBe("code");
    expect(dockTabs(withoutComponent).map((tab) => tab.id)).toEqual(["design", "a11y"]);
  });
});
