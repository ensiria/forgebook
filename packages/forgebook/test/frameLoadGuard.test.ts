// @vitest-environment happy-dom
/**
 * Tests for the frame's load guard, run as the frame's page runs it: a module that could not be loaded is loaded again
 * before its error shows, code that throws shows at once, what is not the catalogue's code is left alone, and the shell
 * is told only on the catalogue's origin.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearRetry, loadReloadsKey } from "../src/frame/staleModule.ts";
import { type FramesPlacement, SAME_ORIGIN } from "../src/frameOrigins.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import { pageHtml } from "../src/vite/pages.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** The guard's script, as the frame's page holds it. */
const guardScript = (placement: FramesPlacement = SAME_ORIGIN): string => {
  const config = resolveConfig(
    { framework: STUB_FRAMEWORK, title: "Catalogue", stories: ["*.stories.tsx"] },
    "/catalogue"
  );
  const html = pageHtml("frame.html", config, placement);
  const start = html.indexOf("<script>") + "<script>".length;
  return html.slice(start, html.indexOf("</script>", start));
};

/** What a page load gives the test: the guard's listener, called as the window would call it. */
type LoadedPage = {
  /** Sends the guard an error event from an element, or from code when none. */
  readonly fail: (from?: HTMLElement) => void;
};

/** What a frame's page has of its window when the guard runs. */
type PageGlobals = {
  /** The page that frames it. */
  readonly parent?: unknown;
  /** Its address. */
  readonly location?: unknown;
};

/**
 * Runs the guard as one load of the frame's page runs it, with its own listener: each call is a page load.
 *
 * @param placement - where the frames run.
 * @param globals - the frame's `parent` and `location`, the test's window's by default.
 */
const loadPage = (placement: FramesPlacement = SAME_ORIGIN, globals: PageGlobals = {}): LoadedPage => {
  const listeners: EventListener[] = [];
  const listen = (_type: string, listener: EventListener): void => void listeners.push(listener);
  new Function("parent", "location", "addEventListener", guardScript(placement))(
    globals.parent ?? window,
    globals.location ?? window.location,
    listen
  );
  return {
    fail: (from?: HTMLElement): void => {
      const event =
        from === undefined ? new ErrorEvent("error", { message: "preview threw" }) : new Event("error");
      if (from !== undefined) Object.defineProperty(event, "target", { value: from });
      for (const listener of listeners) listener(event);
    }
  };
};

/** An element of the page, as one that failed to load. */
const element = (tag: "img" | "link" | "script", type = ""): HTMLElement => {
  const made = document.createElement(tag);
  if (made instanceof HTMLScriptElement) made.type = type;
  return made;
};

/** A module script of the page. */
const moduleScript = (): HTMLElement => element("script", "module");

describe("the frame's load guard", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-forgebook-status");
    document.documentElement.removeAttribute("data-forgebook-started");
    document.body.innerHTML = '<div id="root"></div>';
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads a module that could not be loaded again, three times, waiting longer each time, then shows the error", () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    for (const [index, wait] of [1000, 2000, 4000].entries()) {
      loadPage().fail(moduleScript());
      vi.advanceTimersByTime(wait - 1);
      expect(reload).toHaveBeenCalledTimes(index);
      vi.advanceTimersByTime(1);
      expect(reload).toHaveBeenCalledTimes(index + 1);
    }
    expect(document.documentElement.getAttribute("data-forgebook-status")).toBeNull();
    loadPage().fail(moduleScript());
    expect(document.documentElement.getAttribute("data-forgebook-status")).toBe("error");
    expect(document.getElementById("root")?.textContent).toContain("could not be loaded");
    // given up, the count is forgotten: the next visit tries again
    expect(sessionStorage.length).toBe(0);
  });

  it("shows code that throws while it loads at once", () => {
    loadPage().fail();
    expect(document.documentElement.getAttribute("data-forgebook-status")).toBe("error");
    expect(document.getElementById("root")?.textContent).toContain("preview threw");
  });

  it("leaves alone an image, a style sheet or a classic script that failed: none is the catalogue's code", () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    const page = loadPage();
    page.fail(element("img"));
    page.fail(element("link"));
    page.fail(element("script"));
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute("data-forgebook-status")).toBeNull();
  });

  it("schedules one reload per page load, and none for a frame that started while it waited", () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    const page = loadPage();
    page.fail(moduleScript());
    page.fail(moduleScript());
    expect(sessionStorage.getItem(loadReloadsKey(window.location.href))).toBe("1");
    document.documentElement.setAttribute("data-forgebook-started", "");
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it("counts under the key the frame clears once its story draws", () => {
    vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    loadPage().fail(moduleScript());
    expect(sessionStorage.length).toBe(1);
    clearRetry(sessionStorage, window.location.href);
    expect(sessionStorage.length).toBe(0);
  });

  it("tells the shell on the catalogue's origin, worked out from the placement and its own address", () => {
    const told: { message: unknown; origin: string }[] = [];
    const shell = {
      postMessage: (message: unknown, origin: string): void => void told.push({ message, origin })
    };
    const address = new URL(
      "http://127.0.0.1:6007/frame.html?story=kit:a--b&shell=https://elsewhere.example"
    );
    const placements: readonly [FramesPlacement, string][] = [
      [{ kind: "ports", catalogue: 6006, frames: 6007 }, "http://127.0.0.1:6006"],
      [
        { kind: "origins", catalogue: "https://ui.example.com", frames: "https://frames.example.com" },
        "https://ui.example.com"
      ],
      [SAME_ORIGIN, "http://127.0.0.1:6007"]
    ];
    for (const [placement, expected] of placements) {
      document.documentElement.removeAttribute("data-forgebook-status");
      document.body.innerHTML = '<div id="root"></div>';
      loadPage(placement, { parent: shell, location: address }).fail();
      expect(told.at(-1)).toEqual({
        message: {
          type: "forgebook:error",
          storyId: "kit:a--b",
          message: expect.stringContaining("preview threw")
        },
        origin: expected
      });
    }
  });

  it("names no path a page's entries would read as one of the frame's modules", () => {
    expect(guardScript({ kind: "ports", catalogue: 6006, frames: 6007 })).not.toMatch(/["']\//);
  });
});
