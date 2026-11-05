// @vitest-environment happy-dom
/**
 * Tests for which fields a simulated finger puts a caret in, and how a tap on one and on its label reach them.
 *
 * @module
 */
import { afterEach, describe, expect, it } from "vitest";

import { editableFieldOf, tapLabel } from "../src/frame/touchCaret.ts";

/** Parses markup into the document's body. */
const draw = (html: string): void => {
  document.body.innerHTML = html;
};

/** The first element a selector finds. */
const part = (selector: string): Element => {
  const element = document.querySelector(selector);
  if (element === null) throw new Error(`no ${selector}`);
  return element;
};

describe("editableFieldOf", () => {
  afterEach(() => draw(""));

  it.each(["text", "search", "url", "tel", "email", "password", "number"])(
    "takes an input of type %s",
    (type) => {
      draw(`<input type="${type}">`);
      expect(editableFieldOf(part("input"))).toBe(part("input"));
    }
  );

  it.each(["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "date"])(
    "leaves an input of type %s to the browser",
    (type) => {
      draw(`<input type="${type}">`);
      expect(editableFieldOf(part("input"))).toBeUndefined();
    }
  );

  it("takes a field read-only, not one disabled", () => {
    draw(`<input id="r" readonly><textarea id="t" readonly></textarea><input id="d" disabled>
      <textarea id="e" disabled></textarea>`);
    expect(editableFieldOf(part("#r"))).toBe(part("#r"));
    expect(editableFieldOf(part("#t"))).toBe(part("#t"));
    expect(editableFieldOf(part("#d"))).toBeUndefined();
    expect(editableFieldOf(part("#e"))).toBeUndefined();
  });

  it("finds a contenteditable's editing host from the text inside it", () => {
    draw(`<div id="host" contenteditable="true"><p><b id="inner">some text</b></p></div>`);
    const text = part("#inner").firstChild;
    if (text === null) throw new Error("no text");
    expect(editableFieldOf(text)).toBe(part("#host"));
    expect(editableFieldOf(part("#inner"))).toBe(part("#host"));
  });

  it("leaves out what is not editable", () => {
    draw(`<div id="plain"><button id="button">go</button></div>`);
    expect(editableFieldOf(part("#plain"))).toBeUndefined();
    expect(editableFieldOf(part("#button"))).toBeUndefined();
  });
});

describe("tapLabel", () => {
  afterEach(() => draw(""));

  it("focuses the text field a label names, from what the label holds", () => {
    draw(`<label for="field"><span id="inside">name</span></label><input id="field">`);
    tapLabel(part("#inside"));
    expect(document.activeElement).toBe(part("#field"));
  });

  it("leaves what is interactive inside the label alone: the field itself, a button", () => {
    draw(`<label>name <input id="field"><button id="button">go</button></label>`);
    tapLabel(part("#field"));
    expect(document.activeElement).toBe(document.body);
    tapLabel(part("#button"));
    expect(document.activeElement).toBe(document.body);
  });

  it("leaves a checkbox to its click", () => {
    draw(`<label for="box"><span id="inside">name</span></label><input id="box" type="checkbox">`);
    tapLabel(part("#inside"));
    expect(document.activeElement).toBe(document.body);
  });
});
