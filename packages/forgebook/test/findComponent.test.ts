/**
 * Tests for finding a component by what it is for, not by its name: the words a designer or an agent would use.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type FindableComponent, findComponents } from "../src/vite/findComponent.ts";

/** A component with what the search reads. */
const component = (title: string, extra: Partial<FindableComponent> = {}): FindableComponent => ({
  id: `kit:${title.toLowerCase()}`,
  title,
  keywords: [],
  stories: [],
  ...extra
});

const LIST: readonly FindableComponent[] = [
  component("Inputs/OptionCards", { keywords: ["radio tile group", "selectable card"] }),
  component("Inputs/Select", { stories: ["A dropdown with a search field"] }),
  component("Overlays/Dialog"),
  component("Actions/Button", { keywords: ["cta"] }),
  component("Layout/Card")
];

const names = (query: string): string[] => findComponents(LIST, query).map((match) => match.title);

describe("findComponents", () => {
  it("finds a component by a word its author declared, the plan's case", () => {
    expect(names("radio tile group")[0]).toBe("Inputs/OptionCards");
  });

  it("ranks a name above a mention", () => {
    expect(names("card")[0]).toBe("Layout/Card");
  });

  it("reads a story's text", () => {
    expect(findComponents(LIST, "dropdown search")[0]).toMatchObject({ title: "Inputs/Select", missed: [] });
  });

  it("knows the words designers and code use for the same thing", () => {
    expect(names("modal")[0]).toBe("Overlays/Dialog");
    expect(names("popup")[0]).toBe("Overlays/Dialog");
  });

  it("takes a word's start, and ignores case and plurals", () => {
    expect(names("Buttons")[0]).toBe("Actions/Button");
    expect(names("dial")[0]).toBe("Overlays/Dialog");
  });

  it("says which words matched, so an agent can judge a weak answer", () => {
    expect(findComponents(LIST, "selectable zebra")[0]).toMatchObject({
      title: "Inputs/OptionCards",
      matched: ["selectable"],
      missed: ["zebra"]
    });
  });

  it("finds nothing for words nothing holds", () => {
    expect(findComponents(LIST, "zebra")).toEqual([]);
    expect(findComponents(LIST, "  ")).toEqual([]);
  });

  it("gives five at most", () => {
    const many = Array.from({ length: 9 }, (_, index) => component(`A/Row${index}`));
    expect(findComponents(many, "row")).toHaveLength(5);
  });
});
