/**
 * The HTML the Code card writes for a Web Components story, and the arg names it reads.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { argTarget, isAttributeName, isElementName, slotArg } from "../src/argNames.ts";
import { storyHtml } from "../src/storyHtml.ts";

describe("storyHtml", () => {
  it("writes attributes as HTML does, and leaves out what HTML cannot hold", () => {
    expect(
      storyHtml("x-button", {
        label: 'Say "hi"',
        count: 3,
        disabled: true,
        hidden: false,
        empty: null,
        ".items": ["a"],
        "@press": "listener",
        icon: { of: "Icon", named: "IconFolder" }
      })
    ).toBe('<x-button label="Say &quot;hi&quot;" count="3" disabled></x-button>');
  });

  it("writes a list as JSON in single quotes, which Lit's Array converter reads", () => {
    expect(storyHtml("x-tags", { tags: ["a", "it's"] })).toBe(`<x-tags tags='["a","it&#39;s"]'></x-tags>`);
  });

  it("writes the unnamed slot as text, and named slots in their spans", () => {
    expect(storyHtml("x-button", { "#default": "Go <now>" })).toBe("<x-button>Go &lt;now&gt;</x-button>");
    expect(storyHtml("x-button", { "#icon": "*", "#default": "Go" })).toBe(
      '<x-button>\n  <span slot="icon">*</span>\n  Go\n</x-button>'
    );
  });

  it("puts each attribute on its own line when they do not fit on one", () => {
    const code = storyHtml("x-button", {
      label: "A rather long label for a big button",
      tone: "danger",
      size: "large"
    });
    expect(code).toBe(
      '<x-button\n  label="A rather long label for a big button"\n  tone="danger"\n  size="large"\n></x-button>'
    );
  });
});

describe("argNames", () => {
  it("reads what an arg sets from its prefix", () => {
    expect(argTarget("label")).toEqual({ kind: "attribute", name: "label" });
    expect(argTarget(".items")).toEqual({ kind: "property", name: "items" });
    expect(argTarget("@change")).toEqual({ kind: "event", name: "change" });
    expect(argTarget("#icon")).toEqual({ kind: "slot", name: "icon" });
    expect(argTarget(".")).toEqual({ kind: "attribute", name: "." });
    expect(slotArg("")).toBe("#default");
  });

  it("refuses what could run a script from a shared link: handler attributes and properties that write HTML", () => {
    for (const name of [
      "onfocus",
      "onClick",
      "innerHTML",
      ".innerHTML",
      ".outerHTML",
      "__proto__",
      ".srcdoc"
    ])
      expect(argTarget(name).kind).toBe("refused");
    expect(argTarget("one-line").kind).toBe("attribute");
    expect(storyHtml("x-button", { onfocus: "alert(1)", label: "A" })).toBe(
      '<x-button label="A"></x-button>'
    );
  });

  it("knows a custom element's name and an attribute's", () => {
    expect(isElementName("my-button")).toBe(true);
    expect(isElementName("Button")).toBe(false);
    expect(isElementName("button")).toBe(false);
    expect(isAttributeName("aria-label")).toBe(true);
    expect(isAttributeName('x"><script')).toBe(false);
  });
});
