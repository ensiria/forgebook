/**
 * Tests for how the searches read a word nothing holds as typed: the distance between two words, how far a word may be
 * from the one meant, and which word of the catalogue it is read as.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { correctedWords, correctionsOf, distanceWithin, typosAllowed } from "../src/searchMatch.ts";

describe("distanceWithin", () => {
  it("counts a letter added, removed, changed, and two swapped, one each", () => {
    expect(distanceWithin("buton", "button", 2)).toBe(1);
    expect(distanceWithin("buttton", "button", 2)).toBe(1);
    expect(distanceWithin("bitton", "button", 2)).toBe(1);
    expect(distanceWithin("dialgo", "dialog", 2)).toBe(1);
    expect(distanceWithin("same", "same", 0)).toBe(0);
  });

  it("gives nothing past the limit, however the words differ", () => {
    expect(distanceWithin("buton", "badge", 1)).toBeUndefined();
    expect(distanceWithin("tab", "tabsbar", 2)).toBeUndefined();
    expect(distanceWithin("abcd", "dcba", 2)).toBeUndefined();
  });
});

describe("typosAllowed", () => {
  it("allows none under four letters, one up to seven, two from eight", () => {
    expect(["tab", "card", "buttonx", "checkbox"].map(typosAllowed)).toEqual([0, 1, 1, 2]);
  });
});

describe("correctionsOf", () => {
  const catalogue = [
    { name: ["button"], prop: ["label", "disabled"] },
    { name: ["button", "group"] },
    { name: ["badge"], text: ["buttons are described here"] },
    { name: ["checkbox"] },
    { name: ["modal"] }
  ];

  it("reads a word as the nearest name, the one used most between names as near", () => {
    expect(correctionsOf(["buton", "chekcbxo"], catalogue)).toEqual([
      { typed: "buton", read: "button" },
      { typed: "chekcbxo", read: "checkbox" }
    ]);
  });

  it("reads a word as a synonym's word, so it finds what that word means", () => {
    expect(correctionsOf(["dialgo"], catalogue)).toEqual([{ typed: "dialgo", read: "dialog" }]);
  });

  it("leaves out a synonym whose group the catalogue does not hold: read as it, the word would find nothing", () => {
    expect(correctionsOf(["toogle"], catalogue)).toEqual([]);
  });

  it("leaves a short word, a far word and prose's words alone", () => {
    expect(correctionsOf(["btn", "zebra", "descrbed"], catalogue)).toEqual([]);
  });

  it("puts the corrections in the query's words, each word once", () => {
    expect(correctedWords(["big", "buton", "button"], [{ typed: "buton", read: "button" }])).toEqual([
      "big",
      "button"
    ]);
  });
});
