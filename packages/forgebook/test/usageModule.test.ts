/**
 * Tests for "Used in" joined from the fixture's facts: direct use and use through another component, the component's
 * own stories and its `related` left out, the order a page shows, a source's groups merged, and a catalogue that turns
 * it off.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { catalogueSettings } from "../src/catalogue.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { mergedUsage } from "../src/usedIn.ts";
import { mergedLists } from "../src/vite/configFile.ts";
import { storyFilesModule } from "../src/vite/storyFilesModule.ts";
import { type UsageGraph, usageGraph } from "../src/vite/usageGraph.ts";
import { joinedUsage, type UsageFile } from "../src/vite/usageModule.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

/** A file of the usage fixture. */
const at = (name: string): string => VITE_PATHS.join(import.meta.dirname, "fixtures", "usage", name);

const GRAPH = ((): UsageGraph => {
  const result = usageGraph([
    { storyFile: at("Badge.stories.tsx"), exports: ["Default"] },
    { storyFile: at("Tree.stories.tsx"), exports: ["Default", "Custom"] },
    { storyFile: at("Card.stories.tsx"), exports: ["Plain", "WithBadge", "InScene"] },
    { storyFile: at("Lonely.stories.tsx"), exports: ["Default"] },
    { storyFile: at("BadgeSizes.stories.tsx"), exports: ["Long"] }
  ]);
  if (typeof result === "string") throw new Error(result);
  return result;
})();

/** The fixture's story files, Badge's `related` given. */
const files = (badgeRelated: readonly string[] = []): UsageFile[] => [
  { storyFile: at("Badge.stories.tsx"), title: "Data/Badge", related: badgeRelated },
  { storyFile: at("Tree.stories.tsx"), title: "Lists/Tree", related: [] },
  { storyFile: at("Card.stories.tsx"), title: "Layout/Card", related: [] },
  { storyFile: at("Lonely.stories.tsx"), title: "Misc/Lonely", related: [] },
  // another page of Badge: never a user of Badge, nor Badge of it
  { storyFile: at("BadgeSizes.stories.tsx"), title: "Data/Badge sizes", related: [] }
];

describe("joinedUsage", () => {
  it("lists the direct users first, then those through another component, and no component for itself", () => {
    expect(joinedUsage(GRAPH, files())).toEqual({
      "Data/Badge": [
        { title: "Layout/Card", isDirect: true, stories: ["WithBadge", "InScene"] },
        // Tree renders Row, and Row renders Badge
        { title: "Lists/Tree", isDirect: false, stories: ["Default", "Custom"] }
      ],
      "Data/Badge sizes": [
        { title: "Layout/Card", isDirect: true, stories: ["WithBadge", "InScene"] },
        { title: "Lists/Tree", isDirect: false, stories: ["Default", "Custom"] }
      ]
    });
  });

  it("leaves out the components the meta already names in related", () => {
    expect(joinedUsage(GRAPH, files(["Lists/Tree"]))["Data/Badge"]?.map((user) => user.title)).toEqual([
      "Layout/Card"
    ]);
  });
});

describe("mergedUsage", () => {
  it("joins a source's groups, in the page's order", () => {
    expect(
      mergedUsage([
        { "Data/Badge": [{ title: "Lists/Tree", isDirect: false, stories: ["Default"] }] },
        {
          "Data/Badge": [{ title: "Layout/Card", isDirect: true, stories: ["WithBadge"] }],
          "Misc/Lonely": []
        }
      ])
    ).toEqual({
      "Data/Badge": [
        { title: "Layout/Card", isDirect: true, stories: ["WithBadge"] },
        { title: "Lists/Tree", isDirect: false, stories: ["Default"] }
      ],
      "Misc/Lonely": []
    });
  });
});

describe("a catalogue that turns Used in off", () => {
  it("offers no usage loader in its files' modules, and says so in its settings", () => {
    const dir = VITE_PATHS.join(import.meta.dirname, "fixtures", "usage");
    const offered = storyFilesModule(dir, "./*.stories.tsx", () => undefined);
    const off = storyFilesModule(dir, "./*.stories.tsx", () => undefined, {
      hasUsage: false,
      hasReach: false
    });
    expect(offered).toContain(`usage: () => import("virtual:forgebook-usage:${dir}::0::*.stories.tsx")`);
    expect(off).not.toContain("usage:");
    expect(off).not.toContain("reach:");
    expect(catalogueSettings("Acme", DEFAULT_SWITCHES).hasUsedIn).toBe(true);
    expect(catalogueSettings("Acme", DEFAULT_SWITCHES, mergedLists([{ usedIn: false }, {}])).hasUsedIn).toBe(
      false
    );
  });
});

describe("a static build's files module", () => {
  it('offers "Used in" without what each story reaches, which only the dev server\'s tools read', () => {
    const dir = VITE_PATHS.join(import.meta.dirname, "fixtures", "usage");
    const built = storyFilesModule(dir, "./*.stories.tsx", () => undefined, {
      hasUsage: true,
      hasReach: false
    });
    expect(built).toContain("usage: () => import(");
    expect(built).not.toContain("reach:");
  });
});

describe("a files module's loaders", () => {
  it("name each story file once, and give every loader of it", async () => {
    const dir = VITE_PATHS.join(import.meta.dirname, "fixtures", "usage");
    const code = storyFilesModule(dir, "./*.stories.tsx", () => undefined, {
      hasUsage: false,
      hasReach: false
    });
    const module: unknown = await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const loaders =
      typeof module === "object" &&
      module !== null &&
      "default" in module &&
      typeof module.default === "object"
        ? module.default
        : null;
    if (loaders === null) throw new Error("no default export");
    const keys = Object.keys(Reflect.get(loaders, "index"));
    for (const name of ["stories", "docs", "code", "pages"]) {
      const column: unknown = Reflect.get(loaders, name);
      expect(Object.keys(column ?? {})).toEqual(keys);
      expect(Object.values(column ?? {}).every((loader) => typeof loader === "function")).toBe(true);
    }
    const first = keys[0] ?? "none";
    expect(code.split(`${JSON.stringify(first)}, () =>`)).toHaveLength(2);
  });
});
