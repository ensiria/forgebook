/**
 * Tests for a plugin's second frame of a story: it is told the values the check accepted, however late the check ends.
 *
 * @module
 */
// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { type AcceptedArgs, checkedAddressArgs } from "../src/addressArgs.ts";
import type { PanelArgs } from "../src/messages.ts";
import { type AsideFrame, showAsideStory } from "../src/shell/asideStory.ts";

/** A frame's report that it is ready, as `isFrameMessage` reads it. */
const READY = {
  type: "forgebook:ready",
  storyId: "kit:a--b",
  canReplay: false,
  hasClock: false,
  args: {},
  textKeys: {},
  argTypes: {},
  controls: "all",
  actions: [],
  fixed: { switches: {} },
  parameters: []
};

/** Values as the check gives them, for a story that declares them as its own args. */
const accepted = (args: PanelArgs): AcceptedArgs =>
  checkedAddressArgs(args, {
    props: [],
    argTypes: {},
    controls: "all",
    storyArgs: args,
    namedValues: {}
  }).sealed;

/** A frame drawn in the document, with what it was told and how it reports. */
type DrawnFrame = {
  readonly aside: AsideFrame;
  readonly told: () => readonly unknown[];
  readonly reportReady: () => void;
};

/** Draws the aside and listens to what the shell tells its frame. */
const draw = (args: AcceptedArgs | undefined): DrawnFrame => {
  // left out of the document: the test's document loads no frame
  const target = document.createElement("div");
  const aside = showAsideStory(target, "Story", {
    address: "about:blank",
    width: "fill",
    background: undefined,
    args,
    view: undefined
  });
  const frame = target.querySelector("iframe");
  if (frame === null) throw new Error("The aside drew no frame");
  // a frame that is not loaded has no window of its own to tell
  const post = vi.fn();
  const story = { postMessage: post };
  Object.defineProperty(frame, "contentWindow", { value: story });
  return {
    aside,
    told: () => post.mock.calls.map(([message]) => message),
    reportReady: (): void => {
      const event = new MessageEvent("message", { data: READY, origin: window.location.origin });
      Object.defineProperty(event, "source", { value: story });
      window.dispatchEvent(event);
    }
  };
};

describe("showAsideStory", () => {
  it("tells a ready frame the accepted values", () => {
    const { reportReady, told } = draw(accepted({ size: "lg" }));
    expect(told()).toEqual([]);
    reportReady();
    expect(told()).toEqual([{ type: "forgebook:args", args: { size: "lg" } }]);
  });

  it("tells nothing while the check waits, then what it accepted", () => {
    const { aside, reportReady, told } = draw(undefined);
    reportReady();
    expect(told()).toEqual([]);
    aside.settle(accepted({ size: "lg" }));
    expect(told()).toEqual([{ type: "forgebook:args", args: { size: "lg" } }]);
  });

  it("keeps the check's values for a frame that is ready after it ended", () => {
    const { aside, reportReady, told } = draw(undefined);
    aside.settle(accepted({ size: "lg" }));
    expect(told()).toEqual([]);
    reportReady();
    expect(told()).toEqual([{ type: "forgebook:args", args: { size: "lg" } }]);
  });

  it("keeps the values of the moment it was asked for", () => {
    const { aside, reportReady, told } = draw(accepted({ size: "lg" }));
    reportReady();
    aside.settle(accepted({ size: "sm" }));
    expect(told()).toEqual([{ type: "forgebook:args", args: { size: "lg" } }]);
  });
});
