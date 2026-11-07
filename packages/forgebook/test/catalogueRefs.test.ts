/**
 * Tests for the composed catalogues (`refs`): what the configuration may give, the addresses the shell makes and what
 * it reads of another catalogue's index.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  type CatalogueRef,
  refEmbedAddress,
  refIndexAddress,
  refIndexOf,
  refStoryAddress
} from "../src/catalogueRefs.ts";
import { switchesProblem, themeSwitch } from "../src/switches.ts";
import { unknownKeysProblem } from "../src/vite/configKeys.ts";
import { refsProblem, resolvedRefs } from "../src/vite/refsConfig.ts";

/** What is wrong with a configuration that gives these refs. */
const problemOf = (refs: unknown): string | undefined => refsProblem({ refs });

/** A catalogue served under a sub-path. */
const DESIGN_SYSTEM: CatalogueRef = {
  id: "design-system",
  title: "Design system",
  url: "https://ds.example.com/catalogue/"
};

describe("the configuration's refs", () => {
  it("takes catalogues by id, each address made its folder", () => {
    const refs = { "design-system": { title: " Design system ", url: "https://ds.example.com/catalogue" } };
    expect(problemOf(refs)).toBeUndefined();
    expect(resolvedRefs(refs)).toEqual([DESIGN_SYSTEM]);
  });

  it("refuses an id the address could not carry plainly, and a catalogue with no title", () => {
    expect(problemOf({ "Design System": { title: "A", url: "https://a.example.com/" } })).toContain(
      "not an id"
    );
    expect(problemOf({ ds: { url: "https://a.example.com/" } })).toBe("refs.ds.title is missing");
  });

  it("refuses an address that is not a public folder on http or https", () => {
    expect(problemOf({ ds: { title: "A", url: "/ds/" } })).toContain("must be an absolute address");
    expect(problemOf({ ds: { title: "A", url: "javascript:alert(1)" } })).toContain("http or https");
    expect(problemOf({ ds: { title: "A", url: "https://me:secret@a.example.com/" } })).toContain(
      "credentials"
    );
    expect(problemOf({ ds: { title: "A", url: "https://a.example.com/?story=x" } })).toContain("no query");
  });

  it("refuses refs written as a list, as another tool's array form would be", () => {
    expect(problemOf([{ title: "A", url: "https://a.example.com/" }])).toContain(
      "must be an object of catalogues"
    );
  });

  it("names a misspelt key of a catalogue", () => {
    expect(unknownKeysProblem({ refs: { ds: { title: "A", ulr: "https://a.example.com/" } } })).toContain(
      'no key "refs.ds.ulr"'
    );
  });
});

describe("a composed catalogue's addresses", () => {
  it("names the catalogue in a parameter no switch may take", () => {
    expect(switchesProblem([{ ...themeSwitch(), id: "ref" }])).toBeDefined();
  });

  it("finds its index beside its pages, under its sub-path", () => {
    expect(refIndexAddress(DESIGN_SYSTEM)).toBe("https://ds.example.com/catalogue/forgebook-agent.json");
  });

  it("opens a story in its own page", () => {
    expect(refStoryAddress(DESIGN_SYSTEM, "kit:button--primary")).toBe(
      "https://ds.example.com/catalogue/?story=kit%3Abutton--primary"
    );
  });

  it("shows a story through its embed page with every switch, defaults included", () => {
    const address = new URL(
      refEmbedAddress(DESIGN_SYSTEM, "kit:button--primary", { theme: "light", locale: "it" })
    );
    expect(address.origin + address.pathname).toBe("https://ds.example.com/catalogue/");
    expect(address.searchParams.has("embed")).toBe(true);
    expect(address.searchParams.get("story")).toBe("kit:button--primary");
    expect(address.searchParams.get("theme")).toBe("light");
    expect(address.searchParams.get("locale")).toBe("it");
  });

  it("never lets a switch take the story's place", () => {
    const address = new URL(refEmbedAddress(DESIGN_SYSTEM, "kit:a--b", { story: "kit:c--d", embed: "0" }));
    expect(address.searchParams.get("story")).toBe("kit:a--b");
    expect(address.searchParams.get("embed")).toBe("");
  });
});

describe("a composed catalogue's index", () => {
  it("lists its components with their listed stories, in its order", () => {
    const index = {
      schema: 1,
      stories: {
        components: [
          {
            id: "kit:button",
            title: "Inputs/Button",
            stories: [
              { id: "kit:button--primary", name: "Primary", isUnlisted: false },
              { id: "kit:button--hidden", name: "Hidden", isUnlisted: true }
            ]
          },
          {
            id: "kit:only-hidden",
            title: "Hidden",
            stories: [{ id: "kit:only-hidden--a", name: "A", isUnlisted: true }]
          }
        ]
      }
    };
    expect(refIndexOf(index)).toEqual({
      components: [
        {
          id: "kit:button",
          title: "Inputs/Button",
          stories: [{ id: "kit:button--primary", name: "Primary" }]
        }
      ]
    });
  });

  it("is none for a file of another version or no index at all", () => {
    expect(refIndexOf({ schema: 2, stories: { components: [] } })).toBeUndefined();
    expect(refIndexOf("<!doctype html>")).toBeUndefined();
  });

  it("leaves out what it cannot read instead of failing the section", () => {
    const index = { schema: 1, stories: { components: [{ id: 1, title: "A", stories: [] }, "x"] } };
    expect(refIndexOf(index)).toEqual({ components: [] });
  });
});
