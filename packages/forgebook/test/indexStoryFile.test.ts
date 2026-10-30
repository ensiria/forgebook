/**
 * Tests for the static index of a story file.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { indexStoryFile } from "../src/vite/indexStoryFile";

describe("indexStoryFile", () => {
  it("reads the title through satisfies and the stories with their names, in order", () => {
    const text = `import type { Meta, Story } from "@forgebook/react";
      export default { title: "Inputs/Selection/Select", component: Select } satisfies Meta<typeof Select>;
      export const Overview: Story<typeof Select> = { render: () => null };
      export const Danger = { name: "Danger · small", args: { tone: "danger" } } satisfies Story;
      export const Empty = {};`;
    expect(indexStoryFile("Select.stories.tsx", text)).toEqual({
      title: "Inputs/Selection/Select",
      stories: [
        { exportName: "Overview" },
        { exportName: "Danger", name: "Danger · small" },
        { exportName: "Empty" }
      ]
    });
  });

  it("refuses a meta held in a variable: the title must be written in the default export", () => {
    const text = "const meta = { title: 'A/B' }; export default meta; export const X = {};";
    expect(indexStoryFile("A.stories.tsx", text)).toBe(
      "A.stories.tsx: the meta's title must be a plain string"
    );
  });

  it("refuses a file without a meta or with a computed title", () => {
    expect(indexStoryFile("A.stories.tsx", "export const X = {};")).toBe(
      "A.stories.tsx has no default export: the meta is the default export (CSF)"
    );
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/" + family };')).toBe(
      "A.stories.tsx: the meta's title must be a plain string"
    );
  });

  it("reads each story's controls and the meta's, written plainly", () => {
    const text = `export default { title: "A/B", parameters: { controls: ["size"] } };
      export const Overview = { parameters: { controls: false }, render: () => null };
      export const Rows = { parameters: { replay: "remount" } };
      export const Some = { parameters: { controls: ["isLoading", "tone"] } };`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      controls: ["size"],
      stories: [
        { exportName: "Overview", controls: [] },
        { exportName: "Rows" },
        { exportName: "Some", controls: ["isLoading", "tone"] }
      ]
    });
  });

  it("reads the height a story's scene needs, its own and the meta's, written plainly (D-469)", () => {
    const text = `export default { title: "A/B", parameters: { height: 240 } };
      export const Open = { parameters: { height: 320 } };
      export const Closed = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      height: 240,
      stories: [{ exportName: "Open", height: 320 }, { exportName: "Closed" }]
    });
    expect(
      indexStoryFile(
        "A.stories.tsx",
        'export default { title: "A/B" }; export const X = { parameters: { height: ROOM } };'
      )
    ).toBe(
      "A.stories.tsx: story X: `parameters.height` must be written as a plain positive number of CSS px"
    );
  });

  it("reads the meta's other places and related components, written plainly (D-492)", () => {
    const text = `export default { title: "Recipes/DataTable", alsoIn: ["Data/Tables"], related: ["Data/Tables/Table"] };
      export const Overview = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "Recipes/DataTable",
      alsoIn: ["Data/Tables"],
      related: ["Data/Tables/Table"],
      stories: [{ exportName: "Overview" }]
    });
  });

  it("reads the meta's search words, written plainly (D-603)", () => {
    const text = `export default { title: "Layout/Inline", keywords: ["horizontal", "row"] };
      export const Overview = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "Layout/Inline",
      keywords: ["horizontal", "row"],
      stories: [{ exportName: "Overview" }]
    });
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/B", keywords: WORDS };')).toBe(
      "A.stories.tsx: the meta's `keywords` must be written as a list of plain strings"
    );
  });

  it("refuses other places or related components that are not plain strings", () => {
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/B", alsoIn: PLACES };')).toBe(
      "A.stories.tsx: the meta's `alsoIn` must be written as a list of plain strings"
    );
    expect(
      indexStoryFile("A.stories.tsx", 'export default { title: "A/B", related: [TITLES.button] };')
    ).toBe("A.stories.tsx: the meta's `related` must be written as a list of plain strings");
  });

  it("marks the story whose parameters say it is the component's demo, written plainly", () => {
    const text = `export default { title: "A/B" };
      export const Overview = {};
      export const Rows = { parameters: { main: true } };
      export const Some = { parameters: { main: IS_MAIN } };`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [{ exportName: "Overview" }, { exportName: "Rows", isMain: true }, { exportName: "Some" }]
    });
  });

  it("refuses controls that are not written plainly: the shell reads them without running the file", () => {
    const text = `export default { title: "A/B" };
      export const X = { parameters: { controls: NAMES } };`;
    expect(indexStoryFile("A.stories.tsx", text)).toBe(
      "A.stories.tsx: story X: `parameters.controls` must be written as `false` or a list of plain strings"
    );
  });

  it("reads each story's group and the first sentence of its TSDoc, without its tags", () => {
    const text = `export default { title: "A/B" };
      /**
       * Hard names in a narrow column: bars wrap as text would. More detail here.
       *
       * @remarks Not this.
       */
      export const Long = { parameters: { group: "worst-case" } };
      // a line comment is not a description
      export const Plain = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [
        {
          exportName: "Long",
          group: "worst-case",
          description: "Hard names in a narrow column: bars wrap as text would."
        },
        { exportName: "Plain" }
      ]
    });
  });

  it("refuses a group that is not one of the story groups", () => {
    const text = `export default { title: "A/B" };
      export const X = { parameters: { group: "extras" } };`;
    expect(indexStoryFile("A.stories.tsx", text)).toBe(
      "A.stories.tsx: story X: `parameters.group` must be written as one of states, motion, in-context, showcase, worst-case, behaviour"
    );
  });

  it("reports a syntax error", () => {
    expect(indexStoryFile("A.stories.tsx", "export default {")).toMatch(/^A\.stories\.tsx does not parse: /);
  });
});
