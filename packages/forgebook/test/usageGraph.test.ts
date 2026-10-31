/**
 * Tests for what each story renders and what each module imports, on a small package where a component is rendered
 * directly, through another, under another name, inside a scene of the story file, and by nobody.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type UsageGraph, usageGraph } from "../src/vite/usageGraph.ts";

/** The usage fixture package. */
const DIR = join(import.meta.dirname, "fixtures", "usage");

/** A file of the fixture. */
const at = (name: string): string => join(DIR, name);

/** The graph of the fixture's story files, read once. */
const graph = ((): UsageGraph => {
  const result = usageGraph([
    { storyFile: at("Badge.stories.tsx"), exports: ["Default"] },
    { storyFile: at("Tree.stories.tsx"), exports: ["Default", "Custom"] },
    { storyFile: at("Card.stories.tsx"), exports: ["Plain", "WithBadge", "InScene"] },
    { storyFile: at("Lonely.stories.tsx"), exports: ["Default"] }
  ]);
  if (typeof result === "string") throw new Error(result);
  return result;
})();

/** What each story of a story file renders, as `story: Component, Component`. */
const renders = (file: string): string[] =>
  (graph.files.find((each) => each.storyFile === at(file))?.stories ?? []).map(
    (story) => `${story.exportName}: ${story.renders.map((ref) => ref.name).join(", ")}`
  );

describe("usageGraph", () => {
  it("resolves the meta's component, written inline or as a constant", () => {
    expect(graph.files.map((file) => file.component)).toEqual([
      { file: at("Badge.tsx"), name: "Badge" },
      { file: at("Tree.tsx"), name: "Tree" },
      { file: at("Card.tsx"), name: "Card" },
      { file: at("Lonely.tsx"), name: "Lonely" }
    ]);
  });

  it("gives a story without JSX its meta's component, and a story's JSX its components, elements left out", () => {
    expect(renders("Tree.stories.tsx")).toEqual(["Default: Tree", "Custom: Tree"]);
    expect(renders("Lonely.stories.tsx")).toEqual(["Default: Lonely"]);
  });

  it("knows a component under another name, and follows a scene of the story file into its JSX", () => {
    expect(renders("Card.stories.tsx")).toEqual([
      "Plain: Card",
      "WithBadge: Card, Badge",
      "InScene: Card, Badge"
    ]);
    const badge = graph.files[2]?.stories[1]?.renders[1];
    expect(badge).toEqual({ file: at("Badge.tsx"), name: "Badge" });
  });

  it("holds the package's own imports the rendered components reach, never a dependency's", () => {
    expect(graph.imports[at("Tree.tsx")]).toEqual([at("Row.tsx")]);
    expect(graph.imports[at("Row.tsx")]).toEqual([at("Badge.tsx")]);
    // react is a dependency: Badge imports nothing of the package
    expect(graph.imports[at("Badge.tsx")]).toEqual([]);
  });
});
