/**
 * What each audience of a component's page sees: the table that decides it, and the documentation file's sections.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { AUDIENCE_PAGES, type PageSection, showsSection } from "../src/shell/audienceLayout.ts";
import { proseFor, proseParts } from "../src/shell/audiencePage.ts";

const AUDIENCES = ["designer", "coder", "tester"] as const;

const HTML = [
  "<p>What it is.</p>\n<pre><code>const a = 1;</code></pre>\n",
  '<h2 id="usage">Usage</h2>\n<p>How to use it.</p>\n',
  "<h2>Accessibility</h2>\n<p>Its keys.</p>\n",
  "<h2>Parts and styling</h2>\n<p>Its parts.</p>\n",
  "<h2>Test ids</h2>\n<p>Its ids.</p>\n"
].join("");

describe("AUDIENCE_PAGES", () => {
  it("gives each audience a page of its own order, every section once", () => {
    for (const audience of AUDIENCES) {
      const { beforeDemo, afterDemo, afterExamples } = AUDIENCE_PAGES[audience];
      const sections: readonly PageSection[] = [...beforeDemo, ...afterDemo, ...afterExamples];
      expect(new Set(sections).size).toBe(sections.length);
      expect(sections[0]).toBe("lead");
    }
  });

  it("puts what each audience came for first", () => {
    expect(AUDIENCE_PAGES.designer.beforeDemo).toContain("guidance");
    expect(AUDIENCE_PAGES.coder.beforeDemo).toContain("api");
    expect(AUDIENCE_PAGES.tester.beforeDemo).toContain("coverage");
  });
});

describe("showsSection", () => {
  it("finds a section in any of an audience's places, so the page starts its loads before the sections come", () => {
    expect(showsSection("designer", "tokens")).toBe(true);
    expect(showsSection("designer", "usedIn")).toBe(true);
    expect(showsSection("coder", "usedIn")).toBe(true);
    expect(showsSection("coder", "tokens")).toBe(false);
    expect(showsSection("tester", "usedIn")).toBe(false);
  });

  it("finds none on everyone's page, which draws its own", () => {
    expect(showsSection("everyone", "usedIn")).toBe(false);
  });
});

describe("proseParts", () => {
  it("cuts a file at its second-level headings, what comes first without a heading", () => {
    expect(proseParts(HTML).map((part) => part.heading)).toEqual([
      "",
      "usage",
      "accessibility",
      "parts and styling",
      "test ids"
    ]);
  });

  it("gives nothing for an empty file", () => {
    expect(proseParts("")).toEqual([]);
  });
});

describe("proseFor", () => {
  it("keeps the file as it is for whoever reads all of it", () => {
    expect(proseFor(HTML, "whole")).toBe(HTML);
  });

  it("takes code and the sections about code away from a designer", () => {
    const html = proseFor(HTML, "design");
    expect(html).toContain("What it is.");
    expect(html).toContain("Accessibility");
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("Parts and styling");
    expect(html).not.toContain("Test ids");
  });

  it("reads a heading's words, not its link's address", () => {
    expect(proseFor('<h2><a href="/api/docs">Overview</a></h2>\n<p>Words.</p>\n', "design")).toContain(
      "Words."
    );
  });

  it("drops a section a designer would see as a bare heading", () => {
    expect(proseFor("<h2>Usage</h2>\n<pre><code>a</code></pre>\n", "design")).toBe("");
  });

  it("stays linear on a code block that never closes", () => {
    expect(proseFor("<pre>".repeat(1000), "design")).toBe("");
  });

  it("gives a tester what testing reads, and the whole file when its headings say nothing of it", () => {
    const html = proseFor(HTML, "testing");
    expect(html).toContain("Its keys.");
    expect(html).toContain("Its ids.");
    expect(html).not.toContain("How to use it.");
    expect(proseFor("<h2>Test-ids</h2>\n<p>Ids.</p>\n<h2>Other</h2>\n", "testing")).not.toContain("Other");
    const italian = "<p>Che cos'è.</p>\n<h2>Accessibilità</h2>\n<p>I tasti.</p>\n";
    expect(proseFor(italian, "testing")).toBe(italian);
  });
});
