// @vitest-environment happy-dom
/**
 * Tests for the frame's load guard, run as the frame's page runs it: code that could not be loaded is loaded again
 * before its error shows, and code that throws shows at once.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/vite/configFile.ts";
import { pageHtml } from "../src/vite/pages.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** The guard's script, as the frame's page holds it. */
const guardScript = (): string => {
  const config = resolveConfig(
    { framework: STUB_FRAMEWORK, title: "Catalogue", stories: ["*.stories.tsx"] },
    "/catalogue"
  );
  const html = pageHtml("frame.html", config);
  const start = html.indexOf("<script>") + "<script>".length;
  return html.slice(start, html.indexOf("</script>", start));
};

/** A script of the page that failed to load. */
const failedScript = (): void => {
  const script = document.createElement("script");
  document.body.append(script);
  script.dispatchEvent(new Event("error"));
};

describe("the frame's load guard", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-forgebook-status");
    document.body.innerHTML = '<div id="root"></div>';
    sessionStorage.clear();
    vi.useFakeTimers();
    // the guard runs as the page's own script
    new Function(guardScript())();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads code that could not be loaded again, three times, waiting longer each time, then shows the error", () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    for (const [index, wait] of [1000, 2000, 4000].entries()) {
      failedScript();
      vi.advanceTimersByTime(wait - 1);
      expect(reload).toHaveBeenCalledTimes(index);
      vi.advanceTimersByTime(1);
      expect(reload).toHaveBeenCalledTimes(index + 1);
    }
    expect(document.documentElement.getAttribute("data-forgebook-status")).toBeNull();
    failedScript();
    expect(document.documentElement.getAttribute("data-forgebook-status")).toBe("error");
    expect(document.getElementById("root")?.textContent).toContain("could not be loaded");
  });
});
