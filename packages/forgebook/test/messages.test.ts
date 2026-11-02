/**
 * Tests for the messages between the shell and a frame.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  detailOf,
  isFrameMessage,
  isShellMessage,
  panelArgsParam,
  parsePanelArgsParam,
  previewValue
} from "../src/messages.ts";

describe("a plugin's report", () => {
  const report = { type: "forgebook:plugin", storyId: "a", plugin: "msw", hint: "2", tab: null };

  it("carries any JSON value, with or without its note", () => {
    expect(isFrameMessage({ ...report, value: { handlers: [{ label: "GET /a" }], n: 1 } })).toBe(true);
    expect(isFrameMessage({ ...report, value: null, hint: null })).toBe(true);
  });

  it("refuses what would not stay what it was, and a message that names no plugin", () => {
    expect(isFrameMessage({ ...report, value: { when: new Date(0) } })).toBe(false);
    expect(isFrameMessage({ ...report, value: [Number.NaN] })).toBe(false);
    expect(isFrameMessage({ ...report, value: undefined })).toBe(false);
    expect(isFrameMessage({ ...report, value: 1, plugin: 1 })).toBe(false);
    expect(isFrameMessage({ ...report, value: 1, hint: 2 })).toBe(false);
    expect(isFrameMessage({ ...report, value: 1, tab: 2 })).toBe(false);
  });
});

describe("messages", () => {
  it("accepts well-formed messages and refuses others", () => {
    const ready = {
      type: "forgebook:ready",
      storyId: "a",
      canReplay: false,
      hasClock: false,
      textKeys: {},
      argTypes: {},
      controls: "all",
      actions: ["onPress"],
      fixed: { switches: { theme: "dark" }, width: 360 },
      parameters: ["msw"]
    };
    expect(isFrameMessage({ ...ready, args: { size: "sm" } })).toBe(true);
    expect(isFrameMessage({ ...ready, args: {}, parameters: "msw" })).toBe(false);
    expect(isFrameMessage({ ...ready, args: { sizes: ["sm", 2] } })).toBe(true);
    expect(isFrameMessage({ ...ready, args: { sizes: ["sm", {}] } })).toBe(false);
    expect(
      isFrameMessage({
        ...ready,
        args: {},
        argTypes: { size: { isHidden: false, control: "radio", options: ["sm", "md"] } },
        controls: ["size"]
      })
    ).toBe(true);
    expect(
      isFrameMessage({ ...ready, args: {}, argTypes: { size: { isHidden: false, control: "dial" } } })
    ).toBe(false);
    expect(isFrameMessage({ ...ready, args: {}, controls: false })).toBe(false);
    expect(isFrameMessage({ ...ready, args: { hint: "Pick one" }, textKeys: { hint: "select.hint" } })).toBe(
      true
    );
    expect(isFrameMessage({ ...ready, args: { onX: {} } })).toBe(false);
    expect(isFrameMessage({ ...ready, args: {}, textKeys: { hint: 1 } })).toBe(false);
    expect(isFrameMessage({ type: "forgebook:ready", storyId: "a", canReplay: false, args: {} })).toBe(false);
    expect(
      isFrameMessage({
        type: "forgebook:call",
        storyId: "a",
        name: "onValueChange",
        values: ['"x"', "{…}"],
        details: [null, '{ "a": 1 }']
      })
    ).toBe(true);
    expect(isFrameMessage({ type: "other", storyId: "a" })).toBe(false);
    expect(isShellMessage({ type: "forgebook:args", args: { isDisabled: true } })).toBe(true);
    expect(
      isShellMessage({ type: "forgebook:args", args: { icon: { of: "IconComponent", named: "IconBell" } } })
    ).toBe(true);
    expect(isShellMessage({ type: "forgebook:args", args: { icon: { named: "IconBell" } } })).toBe(false);
    expect(isShellMessage({ type: "forgebook:events", names: ["onValueChange"] })).toBe(true);
    expect(isShellMessage({ type: "forgebook:events", names: [1] })).toBe(false);
    const view = {
      switches: { theme: "dark", contrast: "more", motion: "reduced" },
      backdrop: "checkerboard",
      text: 125
    };
    expect(isShellMessage({ type: "forgebook:view", view })).toBe(true);
    expect(isShellMessage({ type: "forgebook:view", view: { ...view, switches: { theme: 2 } } })).toBe(false);
    expect(isShellMessage({ type: "forgebook:view", view: { ...view, text: "110" } })).toBe(false);
    expect(isShellMessage({ type: "forgebook:view", view: { ...view, switches: undefined } })).toBe(false);
    expect(isShellMessage({ type: "forgebook:check" })).toBe(true);
    expect(isShellMessage({ type: "forgebook:matrix", matrix: null })).toBe(true);
    expect(
      isShellMessage({ type: "forgebook:matrix", matrix: { rows: { name: "size", values: ["sm"] } } })
    ).toBe(true);
    expect(isShellMessage({ type: "forgebook:matrix", matrix: {} })).toBe(false);
    expect(isShellMessage({ type: "forgebook:play-again" })).toBe(true);
    expect(isShellMessage({ type: "forgebook:tools", tools: ["outline", "measure"] })).toBe(true);
    expect(isShellMessage({ type: "forgebook:tools", tools: ["ruler"] })).toBe(false);
    expect(isShellMessage({ type: "forgebook:spills", isOn: true })).toBe(true);
    expect(isShellMessage({ type: "forgebook:spills" })).toBe(false);
    expect(isFrameMessage({ type: "forgebook:spills", storyId: "a", count: 2 })).toBe(true);
    expect(isFrameMessage({ type: "forgebook:spills", storyId: "a", count: "2" })).toBe(false);
    const trace = {
      status: "failed",
      steps: [{ label: "open", status: "failed", ms: 3, error: "x" }],
      error: "x"
    };
    expect(isFrameMessage({ type: "forgebook:play", storyId: "a", trace })).toBe(true);
    expect(
      isFrameMessage({ type: "forgebook:play", storyId: "a", trace: { ...trace, status: "done" } })
    ).toBe(false);
    const violation = {
      id: "image-alt",
      help: "Images need a text",
      impact: "critical",
      helpUrl: "u",
      targets: ["img"]
    };
    expect(isFrameMessage({ type: "forgebook:checked", storyId: "a", violations: [violation] })).toBe(true);
    expect(
      isFrameMessage({
        type: "forgebook:checked",
        storyId: "a",
        violations: [{ ...violation, impact: "huge" }]
      })
    ).toBe(false);
    expect(isFrameMessage({ type: "forgebook:check-error", storyId: "a", message: "axe failed" })).toBe(true);
  });

  it("keeps the panel's values in the address, numbers apart from texts, and ignores a broken parameter", () => {
    const args = { size: "xl", value: 12, label: "12", isRaised: true };
    expect(parsePanelArgsParam(panelArgsParam(args))).toEqual(args);
    expect(panelArgsParam({})).toBe("");
    expect(parsePanelArgsParam(null)).toEqual({});
    expect(parsePanelArgsParam("{not json")).toEqual({});
    expect(parsePanelArgsParam('{"onClick":{}}')).toEqual({});
  });

  it("gives an object's or a list's content for the log, and nothing for other values", () => {
    const circular: Record<string, unknown> = { a: 1, run: () => 1 };
    circular["self"] = circular;
    expect(detailOf({ a: 1, list: [2] })).toBe('{\n  "a": 1,\n  "list": [\n    2\n  ]\n}');
    expect(detailOf(circular)).toContain('"self": "[circular]"');
    expect(detailOf(circular)).toContain('"run": "ƒ"');
    expect(detailOf("text")).toBeNull();
    expect(detailOf({ nativeEvent: {} })).toBeNull();
    expect(detailOf({ long: "x".repeat(3000) })?.endsWith("…")).toBe(true);
  });

  it("writes an event's arguments short", () => {
    expect(previewValue("monthly")).toBe('"monthly"');
    expect(previewValue(3)).toBe("3");
    expect(previewValue(undefined)).toBe("undefined");
    expect(previewValue(() => 1)).toBe("ƒ");
    expect(previewValue({ nativeEvent: {} })).toBe("SyntheticEvent");
    expect(previewValue([1, 2])).toBe("[…2]");
    expect(previewValue({ a: 1 })).toBe("{…}");
  });
});
