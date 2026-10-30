/**
 * Tests for the static index of a story file.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { indexStoryFile } from "../src/vite/indexStoryFile.ts";

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

  it("reads a meta held in a constant of the file (`export default meta`)", () => {
    const text = "const meta = { title: 'A/B' } satisfies Meta; export default meta; export const X = {};";
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({ title: "A/B", stories: [{ exportName: "X" }] });
  });

  it("takes the path's title for a meta without one, and notes a title written by code", () => {
    expect(
      indexStoryFile("A.stories.tsx", "export default {}; export const X = {};", { autoTitle: "A" })
    ).toEqual({
      title: "A",
      stories: [{ exportName: "X" }]
    });
    expect(
      indexStoryFile("A.stories.tsx", 'export default { title: "A/" + family };', { autoTitle: "Kit/A" })
    ).toEqual({
      title: "Kit/A",
      notes: ['its title is written by code, so it is placed by its path as "Kit/A"'],
      stories: []
    });
  });

  it("refuses a file without a meta, or without a title when its path gives none", () => {
    expect(indexStoryFile("A.stories.tsx", "export const X = {};")).toBe(
      "A.stories.tsx has no meta: the default export is an object (CSF)"
    );
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/" + family };')).toBe(
      "A.stories.tsx: the meta's title must be a plain string (or the file must sit where its path makes one)"
    );
  });

  it("reads CSF 2 function stories with the properties assigned after them", () => {
    const text = `export default { title: "A/B" };
      export const Primary = (args) => <Button {...args} />;
      Primary.storyName = "The primary";
      Primary.parameters = { controls: ["label"] };
      export function Secondary() { return null; }
      Secondary.tags = ["!autodocs"];`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [
        { exportName: "Primary", name: "The primary", controls: ["label"] },
        { exportName: "Secondary", tags: ["!autodocs"] }
      ]
    });
  });

  it("reads CSF 2 stories bound from a template, with the properties assigned after them", () => {
    const text = `export default { title: "A/B" };
      const Template = (args) => <Button {...args} />;
      export const Primary = Template.bind({});
      Primary.storyName = "Bound";
      export const helper = format.call(null);`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [{ exportName: "Primary", name: "Bound" }]
    });
  });

  it("reads re-exported stories under their exported names, never another file's", () => {
    const text = `export default { title: "A/B" };
      const Base = {};
      export { Base as Overview };
      export { Other } from "./other.stories";`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [{ exportName: "Overview" }]
    });
  });

  it("keeps only the stories includeStories and excludeStories let in, and skips what is no story", () => {
    const listed = `export default { title: "A/B", excludeStories: ["mockData"] };
      export const mockData = { rows: [] };
      export const Overview = {};
      export const VERSION = "1";`;
    const index = indexStoryFile("A.stories.tsx", listed);
    expect(typeof index === "string" ? index : index.stories.map((story) => story.exportName)).toEqual([
      "Overview"
    ]);
    const matched = `export default { title: "A/B", includeStories: /^[A-Z]/ };
      export const mockData = {};
      export const Overview = {};`;
    const included = indexStoryFile("A.stories.tsx", matched);
    expect(
      typeof included === "string" ? included : included.stories.map((story) => story.exportName)
    ).toEqual(["Overview"]);
  });

  it("orders the stories as __namedExportsOrder says", () => {
    const text = `export default { title: "A/B" };
      export const First = {};
      export const Second = {};
      export const __namedExportsOrder = ["Second", "First"];`;
    const index = indexStoryFile("A.stories.tsx", text);
    expect(typeof index === "string" ? index : index.stories.map((story) => story.exportName)).toEqual([
      "Second",
      "First"
    ]);
  });

  it("combines the meta's tags with each story's, a !tag taking one away", () => {
    const text = `export default { title: "A/B", tags: ["autodocs", "beta"] };
      export const X = { tags: ["!beta", "new"] };
      export const Y = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [
        { exportName: "X", tags: ["autodocs", "!beta", "new"] },
        { exportName: "Y", tags: ["autodocs", "beta"] }
      ]
    });
  });

  it("reads the docs descriptions Storybook's files write, the TSDoc first", () => {
    const text = `export default {
        title: "A/B",
        parameters: { docs: { description: { component: "A button." } } }
      };
      export const X = { parameters: { docs: { description: { story: "The default." } } } };
      /** From the TSDoc. */
      export const Y = { parameters: { docs: { description: { story: "Not this." } } } };`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      description: "A button.",
      stories: [
        { exportName: "X", description: "The default." },
        { exportName: "Y", description: "From the TSDoc." }
      ]
    });
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
        'export default { title: "A/B" }; export const X = { parameters: { height: 0 } };'
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
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/B", keywords: "row" };')).toBe(
      "A.stories.tsx: the meta's `keywords` must be written as a list of plain strings"
    );
  });

  it("refuses other places or related components written plainly but wrongly, and leaves code to the frame", () => {
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/B", alsoIn: [1] };')).toBe(
      "A.stories.tsx: the meta's `alsoIn` must be written as a list of plain strings"
    );
    expect(
      indexStoryFile("A.stories.tsx", 'export default { title: "A/B", related: [TITLES.button] };')
    ).toEqual({
      title: "A/B",
      stories: []
    });
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

  it("refuses controls written plainly but wrongly, and leaves controls written by code to the frame", () => {
    const wrong = `export default { title: "A/B" };
      export const X = { parameters: { controls: true } };`;
    expect(indexStoryFile("A.stories.tsx", wrong)).toBe(
      "A.stories.tsx: story X: `parameters.controls` must be written as `false` or a list of plain strings"
    );
    const computed = `export default { title: "A/B" };
      export const X = { parameters: { controls: NAMES } };
      export const Y = { parameters: { controls: { exclude: ["onClick"] } } };`;
    expect(indexStoryFile("A.stories.tsx", computed)).toEqual({
      title: "A/B",
      stories: [{ exportName: "X" }, { exportName: "Y" }]
    });
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

  it("takes any group written as a plain string, the catalogue's or not, and leaves one written by code", () => {
    const named = `export default { title: "A/B" };
      export const X = { parameters: { group: "extras" } };`;
    const index = indexStoryFile("A.stories.tsx", named);
    expect(typeof index === "string" ? index : index.stories[0]?.group).toBe("extras");
    const computed = `const GROUP = "extras";
      export default { title: "A/B" };
      export const X = { parameters: { group: GROUP } };`;
    expect(indexStoryFile("A.stories.tsx", computed)).toEqual({
      title: "A/B",
      stories: [{ exportName: "X" }]
    });
  });

  it("reports a syntax error", () => {
    expect(indexStoryFile("A.stories.tsx", "export default {")).toMatch(/^A\.stories\.tsx does not parse: /);
  });
});
