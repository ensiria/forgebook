/**
 * Tests for the sentences the API reference writes under a prop and under a component that lists no props.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { sentencePieces } from "../src/shell/codeSpans.ts";
import { propNoteTexts, propsNoteText } from "../src/shell/propNotes.ts";

describe("propNoteTexts", () => {
  it("says when a variant's prop can be passed, its values as written", () => {
    expect(propNoteTexts({ onlyWhen: { prop: "kind", values: ["link", 2, true] } })).toEqual([
      'Only when `kind` is `"link"` or `2` or `true`.'
    ]);
  });

  it("says what each type parameter is shown as, a missing name, and an any", () => {
    expect(
      propNoteTexts({
        notes: [
          { reason: "generic", parameter: "TKey", shownAs: "constraint", type: "string" },
          { reason: "generic", parameter: "TItem", shownAs: "unknown", type: "unknown" },
          { reason: "unresolved", name: "Missing" },
          { reason: "any" }
        ]
      })
    ).toEqual([
      "`TKey` is generic: shown as its constraint, `string`.",
      "`TItem` is generic, with no constraint: shown as `unknown`.",
      "`Missing` cannot be found, so this type is read as `any`.",
      "Typed `any`: nothing is known of its values."
    ]);
  });

  it("says a prop also applies with the discriminant left out", () => {
    expect(propNoteTexts({ onlyWhen: { prop: "mode", values: ["single"], orOmitted: true } })).toEqual([
      'Only when `mode` is `"single"`, or left out.'
    ]);
    expect(propNoteTexts({ onlyWhen: { prop: "mode", values: [], orOmitted: true } })).toEqual([
      "Only when `mode` is left out."
    ]);
  });

  it("writes a type holding backticks as one code span", () => {
    const [text] = propNoteTexts({
      notes: [{ reason: "generic", parameter: "TName", shownAs: "constraint", type: "`on-click`" }]
    });
    expect(text).toBe("`TName` is generic: shown as its constraint, `` `on-click` ``.");
    expect(sentencePieces(text ?? "")).toEqual([
      { text: "TName", isCode: true },
      { text: " is generic: shown as its constraint, ", isCode: false },
      { text: "`on-click`", isCode: true },
      { text: ".", isCode: false }
    ]);
  });

  it("writes nothing for a plain prop", () => {
    expect(propNoteTexts({})).toEqual([]);
  });
});

describe("propsNoteText", () => {
  it("says why a component lists no props", () => {
    expect(propsNoteText({ propsNote: { reason: "untyped" } })).toBe(
      "Its props are typed `any`, so none can be listed."
    );
    expect(propsNoteText({ propsNote: { reason: "outside-package", count: 1 } })).toMatch(
      /^Its one prop comes/
    );
    expect(propsNoteText({ propsNote: { reason: "outside-package", count: 3 } })).toMatch(
      /^All 3 of its props/
    );
    expect(propsNoteText({})).toBeUndefined();
  });
});
