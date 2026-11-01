/**
 * Tests for the direction the frame draws a story in: a language read right to left sets it, leaving that language
 * gives the root its own direction back, also in a catalogue without the direction switch.
 *
 * @module
 */
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { applyView } from "../src/frame/frameView.ts";
import { menuControlIds } from "../src/shell/ViewMenu.tsx";
import { catalogueSwitches } from "../src/switches.ts";
import { placedControls } from "../src/toolbarLayout.ts";
import { DEFAULT_VIEW } from "../src/viewState.ts";

const LANGUAGES = [
  { id: "ar", label: "العربية", dir: "rtl" as const },
  { id: "en", label: "English" }
];

describe("applyView's direction", () => {
  it("sets right to left for such a language and takes it back after, with no direction switch", () => {
    const switches = catalogueSwitches(undefined, LANGUAGES, { direction: false });
    const catalogue = catalogueSettings("A", switches);
    const root = document.createElement("html");
    applyView(root, { ...DEFAULT_VIEW, switches: { lang: "ar" } }, catalogue);
    expect(root.getAttribute("dir")).toBe("rtl");
    applyView(root, { ...DEFAULT_VIEW, switches: { lang: "en" } }, catalogue);
    expect(root.hasAttribute("dir")).toBe(false);
  });
});

describe("menuControlIds", () => {
  it("counts a pinned control the bar has no room for among the menu's, the width aside", () => {
    const catalogue = catalogueSettings("A", catalogueSwitches(undefined, []));
    const placed = placedControls(catalogue, undefined);
    const pinned = placed.filter((each) => each.isPinned).map((each) => each.control.id);
    expect(menuControlIds(placed)).not.toContain(pinned[0]);
    expect(menuControlIds(placed, [pinned[0] ?? ""])).toContain(pinned[0]);
    expect(menuControlIds(placed, ["width"])).not.toContain("width");
  });
});
