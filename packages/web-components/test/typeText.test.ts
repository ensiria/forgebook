/**
 * A prop's kind from a type written as text, as a Custom Elements Manifest writes it.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { manifestModules } from "../src/vite/manifest.ts";
import { typeTextDocs } from "../src/vite/typeText.ts";

describe("typeTextDocs", () => {
  it("reads choices in the order written, without undefined and null", () => {
    expect(typeTextDocs("'sm' | \"md\" | -1 | undefined | null")).toEqual({
      kind: "choice",
      type: "'sm' | \"md\" | -1",
      choices: ["sm", "md", -1]
    });
  });

  it("reads text, numbers and toggles", () => {
    expect(typeTextDocs("string").kind).toBe("text");
    expect(typeTextDocs("number | undefined").kind).toBe("number");
    expect(typeTextDocs("boolean").kind).toBe("toggle");
    expect(typeTextDocs("true | false").kind).toBe("toggle");
  });

  it("offers a text field for a union that takes a string, and nothing for the rest", () => {
    expect(typeTextDocs("string | HTMLElement")).toEqual({
      kind: "other",
      type: "string | HTMLElement",
      canTakeText: true
    });
    expect(typeTextDocs("Date")).toEqual({ kind: "other", type: "Date" });
    expect(typeTextDocs(undefined)).toEqual({ kind: "other", type: "unknown" });
  });
});

describe("manifestModules", () => {
  it("leaves out what has another shape than the schema's", () => {
    expect(manifestModules("nope")).toEqual([]);
    expect(
      manifestModules({
        modules: [{ path: "a.js", declarations: [{ kind: "class" }, 3] }, { declarations: [] }]
      })
    ).toEqual([{ path: "a.js", description: "", elements: [] }]);
  });
});
