/**
 * The code writer of an Angular catalogue, and the selectors it writes an element from: what a developer would write
 * in a template for a story drawn from its args.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { selectorElement } from "../src/selectorElement.ts";
import { argOfContent, contentOfArg } from "../src/slotArgs.ts";
import { storyTemplate } from "../src/storyTemplate.ts";

describe("the element a selector matches", () => {
  it("reads an element, an attribute with or without a value, a class, and the first of a list", () => {
    expect(selectorElement("fb-badge")).toEqual({ tag: "fb-badge", attributes: [], classes: [] });
    expect(selectorElement("button[fbButton]")).toEqual({
      tag: "button",
      attributes: [["fbButton", undefined]],
      classes: []
    });
    expect(selectorElement("[fbTooltip]").tag).toBe("div");
    expect(selectorElement('input[type="range"].wide')).toEqual({
      tag: "input",
      attributes: [["type", "range"]],
      classes: ["wide"]
    });
    expect(selectorElement("a[fbLink], button[fbLink]").tag).toBe("a");
    expect(selectorElement("fb-x:not(.y)")).toEqual({ tag: "fb-x", attributes: [], classes: [] });
  });
});

describe("the args that fill projected content", () => {
  it("names the default content #default and any other by its selector", () => {
    expect(contentOfArg("#default")).toBe("*");
    expect(contentOfArg("#[icon]")).toBe("[icon]");
    expect(contentOfArg("label")).toBeUndefined();
    expect(contentOfArg("#")).toBeUndefined();
    expect(argOfContent(undefined)).toBe("#default");
    expect(argOfContent("fb-title")).toBe("#fb-title");
  });
});

describe("a story's template", () => {
  it("writes a text as an attribute and anything else bound", () => {
    expect(
      storyTemplate("fb-badge", { label: "New", count: 3, removable: true, hidden: false, icon: null })
    ).toBe(
      '<fb-badge\n  label="New"\n  [count]="3"\n  [removable]="true"\n  [hidden]="false"\n  [icon]="null"\n></fb-badge>'
    );
    expect(storyTemplate("fb-badge", { label: "New", count: 3 })).toBe(
      '<fb-badge label="New" [count]="3"></fb-badge>'
    );
  });

  it("writes a list and a named value as expressions, escaping what a template would read", () => {
    expect(
      storyTemplate("fb-tabs", { tabs: ["a", "it's"], icon: { of: "icons", named: "IconFolder" } })
    ).toBe("<fb-tabs [tabs]=\"['a', 'it\\'s']\" [icon]=\"IconFolder\"></fb-tabs>");
    expect(storyTemplate("fb-badge", { label: 'say "hi"' })).toBe(
      '<fb-badge label="say &quot;hi&quot;"></fb-badge>'
    );
  });

  it("leaves out a name that is not one, and binds a text Angular would read as an interpolation", () => {
    expect(storyTemplate("fb-x", { 'a="1" (click)="x()" b': "y", label: "{{ 1+1 }}" })).toBe(
      "<fb-x [label]=\"'{{ 1+1 }}'\"></fb-x>"
    );
    expect(storyTemplate("fb-x", { icon: { of: "icons", named: "a()" } })).toBe(
      '<fb-x [icon]="null"></fb-x>'
    );
  });

  it("writes an attribute selector's element, and a void element closed", () => {
    expect(storyTemplate("button[fbButton]", { tone: "danger" })).toBe(
      '<button fbButton tone="danger"></button>'
    );
    expect(storyTemplate("input[fbField]", { size: 2 })).toBe('<input fbField [size]="2" />');
  });

  it("writes projected content: the default as its text, any other in an element its selector matches", () => {
    expect(storyTemplate("fb-card", { "#default": "Body {x} @if" })).toBe(
      "<fb-card>Body &#123;x&#125; &#64;if</fb-card>"
    );
    expect(
      storyTemplate("fb-card", { title: "T", "#[header]": "Head", "#default": "Body", "#.empty": false })
    ).toBe('<fb-card title="T">\n  <div header>Head</div>\n  Body\n</fb-card>');
  });
});
