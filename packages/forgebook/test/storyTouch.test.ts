/**
 * Tests for the touch of the stories marked for a phone: on by default, the user's choice per story, and a change on
 * a story's page split between the address and the story.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyTouchesOf, storyViewChange, touchedView } from "../src/shell/storyTouch.ts";
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
  design: undefined,
  tags: [],
  hasPlay: false
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
