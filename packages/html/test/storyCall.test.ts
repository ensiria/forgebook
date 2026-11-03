/**
 * The code of an HTML story drawn from its args: its function's call.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyCall } from "../src/storyCall.ts";

describe("storyCall", () => {
  it("writes the call with the args as an object literal", () => {
    expect(storyCall("button", { label: "Save", tone: "danger", count: 2, disabled: true, note: null })).toBe(
      'button({ label: "Save", tone: "danger", count: 2, disabled: true, note: null })'
    );
  });

  it("writes no args as an empty call, a list as a list and a named value by its name", () => {
    expect(storyCall("divider", {})).toBe("divider()");
    expect(storyCall("chips", { items: ["a", "b"], icon: { of: "Icon", named: "starIcon" } })).toBe(
      'chips({ items: ["a", "b"], icon: starIcon })'
    );
  });

  it("quotes a key and a text that are not names, so the code stays JavaScript", () => {
    expect(storyCall("card", { "data-id": 'say "hi"', icon: { of: "Icon", named: "not a name" } })).toBe(
      'card({ "data-id": "say \\"hi\\"", icon: "not a name" })'
    );
  });

  it("goes on several lines past eighty characters", () => {
    expect(
      storyCall("createButton", { label: "A label long enough", tone: "danger", hint: "Another long text" })
    ).toBe(
      'createButton({\n  label: "A label long enough",\n  tone: "danger",\n  hint: "Another long text"\n})'
    );
  });
});
