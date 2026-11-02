/**
 * Tests for the touch of the stories marked for a phone: on by default, the user's choice per story, and a change on
 * a story's page split between the address and the story.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { NO_DEVICE } from "../src/deviceView.ts";
import { phoneStories, storyTouchesOf, storyViewChange, touchedView } from "../src/shell/storyTouch.ts";
import type { TreeStory } from "../src/storyTree.ts";
import { touchChoiceOf } from "../src/switches.ts";
import { DEFAULT_VIEW, type ViewState } from "../src/viewState.ts";
import { FIXTURE_SWITCHES } from "./fixtureSwitches.ts";

/** The fixture's touch switch. */
const CHOICE = touchChoiceOf(FIXTURE_SWITCHES);

/**
 * A story of the tree.
 *
 * @param id - its id.
 * @param isTouch - whether it is marked for a phone.
 */
const storyOf = (id: string, isTouch: boolean): TreeStory => ({
  id,
  name: id,
  exportName: id,
  controls: "all",
  group: undefined,
  description: undefined,
  isMain: false,
  isTouch,
  isLogic: false,
  height: undefined,
  device: undefined,
  tags: []
});

const PHONE = storyOf("phone", true);
const DESK = storyOf("desk", false);

describe("the stories marked for a phone", () => {
  it("start with a finger, follow the user's choice, and leave the other stories out", () => {
    expect(storyTouchesOf([PHONE, DESK], new Map())).toEqual(new Map([["phone", true]]));
    expect(storyTouchesOf([PHONE, DESK], new Map([["phone", false]]))).toEqual(new Map([["phone", false]]));
  });

  it("draw a marked story with its own finger and every other one with the view", () => {
    const touches = storyTouchesOf([PHONE, DESK], new Map());
    expect(touchedView(DEFAULT_VIEW, "phone", touches, CHOICE).switches["touch"]).toBe("touch");
    expect(touchedView(DEFAULT_VIEW, "desk", touches, CHOICE)).toBe(DEFAULT_VIEW);
    expect(touchedView(DEFAULT_VIEW, undefined, touches, CHOICE)).toBe(DEFAULT_VIEW);
    expect(touchedView(DEFAULT_VIEW, "phone", touches, undefined)).toBe(DEFAULT_VIEW);
  });

  it("keep a change of the Touch switch on a marked story's page to the story", () => {
    const next: ViewState = { ...DEFAULT_VIEW, switches: { theme: "dark" }, zoom: 150 };
    expect(storyViewChange(next, DEFAULT_VIEW, PHONE, CHOICE)).toEqual({ view: next, isTouch: false });
    const touched: ViewState = { ...next, switches: { theme: "dark", touch: "touch" } };
    expect(storyViewChange(touched, DEFAULT_VIEW, PHONE, CHOICE)).toEqual({ view: next, isTouch: true });
    expect(storyViewChange(touched, DEFAULT_VIEW, DESK, CHOICE)).toEqual({ view: touched });
  });
});

describe("a story shown in a device", () => {
  const framed: TreeStory = { ...DESK, id: "framed", device: { frame: true, model: "iphone-16" } };
  const untouched: TreeStory = { ...DESK, id: "untouched", device: { frame: true, touch: false } };

  it("is touched as a phone is while its device is shown, unless its device says otherwise", () => {
    const auto = phoneStories({ device: "auto", orientation: "auto" }, NO_DEVICE);
    expect(storyTouchesOf([framed, untouched, DESK], new Map(), auto)).toEqual(new Map([["framed", true]]));
    // the reader still turns it off
    expect(storyTouchesOf([framed], new Map([["framed", false]]), auto)).toEqual(
      new Map([["framed", false]])
    );
  });

  it("is not once the reader turns its frame off, and any story is once the reader frames it", () => {
    const off = phoneStories({ device: "off", orientation: "auto" }, NO_DEVICE);
    expect(storyTouchesOf([framed], new Map(), off)).toEqual(new Map());
    const pixel = phoneStories({ device: "pixel-9", orientation: "auto" }, NO_DEVICE);
    expect(storyTouchesOf([DESK], new Map(), pixel)).toEqual(new Map([["desk", true]]));
  });
});
