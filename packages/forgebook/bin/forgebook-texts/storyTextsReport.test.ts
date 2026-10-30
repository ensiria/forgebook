/**
 * Tests for `forgebook-texts`' report.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyTextsReport, usedKeys } from "./storyTextsReport.ts";

describe("usedKeys", () => {
  it("finds every literal key given to text(), in either quotes, with or without values", () => {
    expect(
      usedKeys(`text("card.title"); text('card.count', { count: 2 }); context.text( "row.name" )`)
    ).toEqual(["card.title", "card.count", "row.name"]);
    expect(usedKeys("subtext(x); text(key)")).toEqual([]);
  });

  it("finds the keys an arg names with storyText()", () => {
    expect(
      usedKeys(`args: { label: storyText("button.save"), hint: storyText('row.count', { count: 2 }) }`)
    ).toEqual(["button.save", "row.count"]);
  });
});

describe("storyTextsReport", () => {
  it("reports keys missing in English, English keys no story uses, and what each language lacks", () => {
    const report = storyTextsReport([`text("a"); text("b")`, `text("c")`], {
      en: { a: "A", b: "B", old: "Old" },
      it: { a: "A it" }
    });
    expect(report).toEqual({
      used: 3,
      missing: ["c"],
      unused: ["old"],
      untranslated: {
        it: [
          { key: "b", text: "B" },
          { key: "old", text: "Old" }
        ]
      }
    });
  });
});
