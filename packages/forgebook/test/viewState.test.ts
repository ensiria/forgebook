/**
 * Tests for the view in the address.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_VIEW, frameAddress, hasViewChanges, parseView, viewParams } from "../src/viewState";

describe("the view in the address", () => {
  it("reads every switch, and the defaults for anything missing or invalid", () => {
    expect(
      parseView(
        "?theme=dark&contrast=more&motion=reduced&speed=slow&press=darken&sheets=structure&text=125&lang=pseudo&compare=1"
      )
    ).toEqual({
      theme: "dark",
      isMoreContrast: true,
      motion: "reduced",
      speed: "slow",
      press: "darken",
      backdrop: "plain",
      sheets: "structure",
      text: 125,
      language: "pseudo",
      compare: "theme",
      width: "fill",
      height: "auto",
      isPanelOpen: true,
      panelTab: "props",
      zoom: 100,
      tools: []
    });
    expect(parseView("?theme=purple&text=110")).toEqual(DEFAULT_VIEW);
  });

  it("writes only what differs from the defaults, and reads back the same view", () => {
    expect(viewParams(DEFAULT_VIEW).toString()).toBe("");
    const view = {
      ...DEFAULT_VIEW,
      motion: "essential",
      speed: "fast",
      text: 150,
      language: "pseudo"
    } as const;
    expect(viewParams(view).toString()).toBe("motion=essential&speed=fast&text=150&lang=pseudo");
    expect(parseView(viewParams(view).toString())).toEqual(view);
  });

  it("marks the View menu when motion, speed, style sheets, text size or language changed, not theme or contrast", () => {
    expect(hasViewChanges({ ...DEFAULT_VIEW, theme: "dark", isMoreContrast: true })).toBe(false);
    expect(hasViewChanges({ ...DEFAULT_VIEW, speed: "slow" })).toBe(true);
    expect(hasViewChanges({ ...DEFAULT_VIEW, sheets: "restyled" })).toBe(true);
    expect(hasViewChanges({ ...DEFAULT_VIEW, language: "pseudo" })).toBe(true);
  });

  it("gives a frame the story and the view, never what only the shell reads", () => {
    expect(
      frameAddress("frame.html", "kit:a-b--c", {
        ...DEFAULT_VIEW,
        theme: "dark",
        compare: "language",
        width: 560,
        height: 320,
        isPanelOpen: false,
        panelTab: "code",
        zoom: 200,
        tools: ["grid"]
      })
    ).toBe("frame.html?theme=dark&story=kit%3Aa-b--c");
  });

  it("keeps the stage's width and the closed panel, and reads a width out of range as the whole stage", () => {
    const view = { ...DEFAULT_VIEW, width: 560, isPanelOpen: false, panelTab: "a11y" } as const;
    expect(viewParams(view).toString()).toBe("width=560&panel=closed&tab=a11y");
    expect(parseView(viewParams(view).toString())).toEqual(view);
    expect(parseView("?width=12").width).toBe("fill");
    expect(parseView("?width=500.5").width).toBe("fill");
    expect(parseView("?width=wide").width).toBe("fill");
  });

  it("keeps the story's height from the foot handle, and reads one out of range as the story's own (note 142)", () => {
    const view = { ...DEFAULT_VIEW, width: 560, height: 320 } as const;
    expect(viewParams(view).toString()).toBe("width=560&height=320");
    expect(parseView(viewParams(view).toString())).toEqual(view);
    expect(parseView("?height=12").height).toBe("auto");
    expect(parseView("?height=99999").height).toBe("auto");
    expect(parseView("?height=tall").height).toBe("auto");
  });

  it("reads every compare mode, and 1, the older form, as the themes", () => {
    expect(parseView("?compare=text").compare).toBe("text");
    expect(parseView("?compare=1").compare).toBe("theme");
    expect(parseView("?compare=sideways").compare).toBe("off");
    expect(viewParams({ ...DEFAULT_VIEW, compare: "sheets" }).toString()).toBe("compare=sheets");
  });

  it("keeps the zoom and the tools, in the tools' order, leaving out unknown ones", () => {
    const view = { ...DEFAULT_VIEW, zoom: 150, tools: ["outline", "measure"] } as const;
    expect(viewParams(view).toString()).toBe("zoom=150&tools=outline%2Cmeasure");
    expect(parseView(viewParams(view).toString())).toEqual(view);
    expect(parseView("?tools=measure,ruler,outline&zoom=300")).toMatchObject({
      tools: ["outline", "measure"],
      zoom: 100
    });
  });
});
