/**
 * Tests for the block syntax of a docs page read from its lines: directives, their labels and attributes, nesting by
 * colons, GitHub alerts, and every mistake noted with its line and column.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  type BodySegment,
  bodySegments,
  noteText,
  type PageNote,
  sourceLines
} from "../src/vite/docDirectives.ts";

/** A body read from its first line on, with what it gets wrong as a person reads it. */
const read = (text: string): { readonly segments: BodySegment[]; readonly notes: string[] } => {
  const notes: PageNote[] = [];
  const segments = bodySegments(sourceLines(text, 1), notes);
  return { segments, notes: notes.map(noteText) };
};

/** A segment's shape without its lines' places: what a test compares. */
const shape = (segment: BodySegment): unknown => {
  switch (segment.type) {
    case "markdown":
      return segment.lines.map((line) => line.text).join("\n");
    case "alert":
      return { alert: segment.kind, children: segment.children.map(shape) };
    case "leaf":
      return { leaf: segment.directive.name, label: segment.directive.label };
    default:
      return {
        container: segment.directive.name,
        label: segment.directive.label,
        attributes: Object.fromEntries(
          [...segment.directive.attributes].map(([key, { value }]) => [key, value])
        ),
        children: segment.children.map(shape)
      };
  }
};

describe("bodySegments", () => {
  it("reads a container with its label and attributes, and the Markdown around it", () => {
    const { segments, notes } = read('Before.\n:::tip[Read **this**]{sync="pm" open}\nInside.\n:::\nAfter.');
    expect(segments.map(shape)).toEqual([
      "Before.",
      {
        container: "tip",
        label: "Read **this**",
        attributes: { sync: "pm", open: "" },
        children: ["Inside."]
      },
      "After."
    ]);
    expect(notes).toEqual([]);
  });

  it("nests by colons, a parent with more than its children, and reads a leaf alone on its line", () => {
    const text = [
      "::::tabs",
      ":::tab[npm]",
      "One.",
      ":::",
      ":::tab[pnpm]",
      "::link-card[Two]{href='./two.md'}",
      ":::",
      "::::"
    ].join("\n");
    const { segments, notes } = read(text);
    expect(segments.map(shape)).toEqual([
      {
        container: "tabs",
        label: undefined,
        attributes: {},
        children: [
          { container: "tab", label: "npm", attributes: {}, children: ["One."] },
          { container: "tab", label: "pnpm", attributes: {}, children: [{ leaf: "link-card", label: "Two" }] }
        ]
      }
    ]);
    expect(notes).toEqual([]);
  });

  it("reads a GitHub alert as a block of its own, its quote's marks taken off, keeping each line's place", () => {
    const notes: PageNote[] = [];
    const [alert] = bodySegments(sourceLines("> [!WARNING]\n> Careful.\n>\n> Twice.\nAfter.", 3), notes);
    expect(alert === undefined ? undefined : shape(alert)).toEqual({
      alert: "WARNING",
      children: ["Careful.\n\nTwice."]
    });
    expect(alert?.type === "alert" ? alert.children[0] : undefined).toMatchObject({
      lines: [
        { line: 4, column: 3 },
        { line: 5, column: 2 },
        { line: 6, column: 3 }
      ]
    });
    expect(notes).toEqual([]);
  });

  it("reads nothing inside a code fence, so a page can show the syntax itself", () => {
    const text = "````md\n:::tip\n> [!NOTE]\n::recent\n````\n:::note\nYes.\n:::";
    const { segments } = read(text);
    expect(segments.map(shape)).toEqual([
      "````md\n:::tip\n> [!NOTE]\n::recent\n````",
      { container: "note", label: undefined, attributes: {}, children: ["Yes."] }
    ]);
  });

  it("notes a block that is never closed, and keeps its content", () => {
    const { segments, notes } = read("Text.\n\n:::note\nStill here.");
    expect(notes).toEqual(["line 3, column 1: `:::note` is never closed: add a line of 3 colons"]);
    expect(segments.map(shape)).toContainEqual(expect.objectContaining({ children: ["Still here."] }));
  });

  it("notes a child with as many colons as its parent, and a closing line that matches nothing", () => {
    expect(read(":::cards\n:::card[A]\nOne.\n:::\n:::").notes).toEqual([
      "line 2, column 1: `:::card` sits inside `:::cards` (line 1), so it needs fewer colons than its parent: give the parent 4"
    ]);
    expect(read(":::note\nText.\n::::").notes).toEqual([
      "line 3, column 1: `::::` does not match `:::note` (line 1): close it with 3 colons"
    ]);
    expect(read("Text.\n:::").notes).toEqual(["line 2, column 1: `:::` closes no block"]);
  });

  it("notes an inner block left open when its parent closes", () => {
    expect(read("::::tabs\n:::tab[a]\nOne.\n::::").notes).toEqual([
      "line 2, column 1: `:::tab` is never closed before line 4 closes its parent: add a line of 3 colons"
    ]);
  });

  it("notes what a directive's line cannot hold, at its column", () => {
    expect(read(":::note[Never ends\n:::").notes).toEqual([
      "line 1, column 8: its label never ends: add `]`"
    ]);
    expect(read(':::note{a="x}\n:::').notes).toEqual(["line 1, column 8: its attributes never end: add `}`"]);
    expect(read(':::note{a="1" a="2"}\n:::').notes).toEqual(['line 1, column 15: "a" is written twice']);
    expect(read(":::note{a=}\n:::").notes).toEqual(['line 1, column 9: "a=" has no value']);
    expect(read(":::note{#id}\n:::").notes).toEqual([
      'line 1, column 9: "#id" is not an attribute: write key="value"'
    ]);
    expect(read(":::note extra\n:::").notes).toEqual([
      'line 1, column 9: "extra" after the block\'s name is not read: a label goes in [ ], attributes in { }'
    ]);
  });

  it("notes an alert GitHub does not have, and a block written after spaces, leaving both as text", () => {
    const { segments, notes } = read("> [!NOTES]\n> Text.\n\n- item\n  :::note\n  :::");
    expect(notes).toEqual([
      "line 1, column 3: `[!NOTES]` is not an alert: write NOTE, TIP, IMPORTANT, WARNING or CAUTION",
      "line 5, column 3: a block written after spaces is not read: start it at the line's start, outside lists"
    ]);
    expect(segments.every((segment) => segment.type === "markdown")).toBe(true);
  });
});
