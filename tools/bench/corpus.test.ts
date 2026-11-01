/**
 * The generated library, and the forms its stories are written in.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { buildCorpus, projectFiles } from "./corpus.ts";

const CORPUS = buildCorpus({ components: 10, stories: 53 });

describe("buildCorpus", () => {
  it("spreads the stories over the components, none left out", () => {
    const counts = CORPUS.components.map((component) => component.stories.length);
    expect(counts.reduce((sum, count) => sum + count)).toBe(53);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("is the same corpus every time, so two machines measure the same files", () => {
    expect(buildCorpus({ components: 10, stories: 53 })).toEqual(CORPUS);
  });

  it("gives a tenth of the stories a play function, never the measured first story", () => {
    const stories = CORPUS.components.flatMap((component) => component.stories);
    expect(stories.filter((story) => story.hasPlay).length).toBe(5);
    expect(CORPUS.components.every((component) => component.stories[0]?.hasPlay === false)).toBe(true);
  });

  it("measures a component in the middle, at the end of a chain, with no play function", () => {
    expect(CORPUS.measured.name).toBe("Widget7");
    expect(CORPUS.measured.stories[0]?.hasPlay).toBe(false);
  });

  it("refuses fewer stories than components, which would leave a file empty", () => {
    expect(() => buildCorpus({ components: 10, stories: 9 })).toThrow("at least one story");
  });
});

describe("projectFiles", () => {
  const csf = projectFiles(CORPUS, "csf3");
  const functions = projectFiles(CORPUS, "functions");
  const first = CORPUS.components[0]?.name ?? "";

  it("writes a component, its style and its stories for each component", () => {
    const paths = Object.keys(csf);
    expect(paths.filter((path) => path.endsWith(".stories.tsx"))).toHaveLength(10);
    expect(
      paths.filter((path) => /components\/\w+\.tsx$/.test(path) && !path.includes(".stories"))
    ).toHaveLength(10);
    expect(paths.filter((path) => path.startsWith("src/components/") && path.endsWith(".css"))).toHaveLength(
      10
    );
  });

  it("writes CSF 3 objects, which is how Forgebook and Storybook users write", () => {
    const stories = csf[`src/components/${first}.stories.tsx`];
    expect(stories).toContain("export const Story0 = {");
    expect(stories).toContain("component:");
  });

  it("writes functions with their args, the only form Ladle draws", () => {
    const stories = functions[`src/components/${first}.stories.tsx`];
    expect(stories).toContain("export const Story0 = (args) =>");
    expect(stories).toContain("Story0.args = {");
  });

  it("differs only in the stories between the two forms", () => {
    const others = (files: Readonly<Record<string, string>>): string[] =>
      Object.entries(files)
        .filter(([path]) => !path.endsWith(".stories.tsx"))
        .map(([path, text]) => `${path}\n${text}`);
    expect(others(functions)).toEqual(others(csf));
  });

  it("links the components, so an edit has a graph to travel and the stories a real module count", () => {
    const second = CORPUS.components[1];
    const text = csf[`src/components/${second?.name}.tsx`];
    expect(text).toContain(`from "./${first}"`);
  });

  it("keeps chains short, or every story would load the whole library", () => {
    const fifth = CORPUS.components[4];
    expect(csf[`src/components/${fifth?.name}.tsx`]).not.toContain('from "./Widget3"');
  });

  it("is a TypeScript project, as the README describes one", () => {
    expect(JSON.parse(csf["tsconfig.json"] ?? "{}").include).toEqual(["src"]);
  });

  it("types and documents the props, so a props table has something to read", () => {
    const text = csf[`src/components/${first}.tsx`];
    expect(text).toContain("/** The text it shows. */");
    expect(text).toContain("readonly tone?:");
  });

  it("gives images and a theme to the stories", () => {
    expect(Object.keys(csf).filter((path) => path.startsWith("src/assets/")).length).toBeGreaterThan(0);
    expect(csf["src/shared/theme.css"]).toContain('[data-theme="dark"]');
  });
});
