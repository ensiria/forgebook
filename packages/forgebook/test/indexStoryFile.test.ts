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

  it("reads a `.js` story file that holds JSX, as libraries written in JavaScript do", () => {
    const text = `export default { title: "Inputs/Button" };
      export const Default = { render: () => <button>Go</button> };`;
    expect(indexStoryFile("Button.stories.js", text)).toEqual({
      title: "Inputs/Button",
      stories: [{ exportName: "Default" }]
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
      Primary.storyName = "Bound";`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [{ exportName: "Primary", name: "Bound" }]
    });
  });

  it("lists every export as a story, as Storybook does, whatever writes its value", () => {
    const text = `export default { title: "A/B" };
      const Template = { args: { tone: "neutral" }, parameters: { height: 120 } };
      export const Made = makeStory({ tone: "danger" });
      Made.storyName = "Made by a helper";
      export const Aliased: Story = Template;
      export const Chained = Aliased;
      export let Later;
      export class NotAStory {}
      export type Props = { tone: string };`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [
        { exportName: "Made", name: "Made by a helper" },
        { exportName: "Aliased", height: 120 },
        { exportName: "Chained", height: 120 },
        { exportName: "Later" }
      ]
    });
  });

  it("reads a meta exported by name (`export { meta as default }`)", () => {
    const text = "const meta = { title: 'A/B' }; export { meta as default }; export const X = {};";
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({ title: "A/B", stories: [{ exportName: "X" }] });
  });

  it("takes a name and an id only from the story's own object, never from another constant it names", () => {
    const text = `export default { title: "A/B", id: "" };
      export const One = { name: "Alpha", parameters: { __id: "a-b--uno", height: 40 } };
      export const Two = One;
      Two.storyName = "Second";
      export const Three = One;`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [
        { exportName: "One", id: "a-b--uno", name: "Alpha", height: 40 },
        { exportName: "Two", name: "Second", height: 40 },
        { exportName: "Three", height: 40 }
      ]
    });
  });

  it("reads the ids a meta and a story write, as Storybook's links name them", () => {
    const text = `export default { title: "Navigation/Menu", id: "menus" };
      export const Overview = {};
      export const Nested = { parameters: { __id: "menus--deep" } };
      export const Coded = { parameters: { __id: prefix + "x" } };`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "Navigation/Menu",
      id: "menus",
      stories: [
        { exportName: "Overview" },
        { exportName: "Nested", id: "menus--deep" },
        { exportName: "Coded" }
      ]
    });
    expect(indexStoryFile("A.stories.tsx", 'export default { title: "A/B", id: name };')).toBe(
      "A.stories.tsx: the meta's `id` must be a plain string"
    );
  });

  it("reads re-exported stories under their exported names, another file's too", () => {
    const text = `export default { title: "A/B" };
      const Base = { name: "The base", parameters: { height: 80 } };
      export { Base as Overview };
      export { Other, Third as "Third story" } from "./other.stories";
      export type { Props } from "./props";
      export * from "./everything";`;
    // as Storybook's indexer, the name comes from the export, the other fields from the object it names
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      stories: [
        { exportName: "Overview", height: 80 },
        { exportName: "Other" },
        { exportName: "Third story" }
      ]
    });
  });

  it("keeps only the stories includeStories and excludeStories let in", () => {
    const listed = `export default { title: "A/B", excludeStories: ["mockData", "VERSION"] };
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

  it("reads the height a story's scene needs, its own and the meta's, written plainly", () => {
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

  it("reads the meta's other places and related components, written plainly", () => {
    const text = `export default { title: "Recipes/DataTable", alsoIn: ["Data/Tables"], related: ["Data/Tables/Table"] };
      export const Overview = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "Recipes/DataTable",
      alsoIn: ["Data/Tables"],
      related: ["Data/Tables/Table"],
      stories: [{ exportName: "Overview" }]
    });
  });

  it("reads the meta's search words, written plainly", () => {
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

  it("reads the meta's prop groups to list first, and refuses them written by code or wrongly", () => {
    const text = `export default { title: "Data/Finder", parameters: { propGroups: ["Selection", "Paging"] } };
      export const Overview = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "Data/Finder",
      propGroups: ["Selection", "Paging"],
      stories: [{ exportName: "Overview" }]
    });
    // the index alone reads it, so a list written by code would be lost
    for (const written of ['"Paging"', "[1]", "GROUPS", '[...GROUPS, "Paging"]']) {
      expect(
        indexStoryFile(
          "A.stories.tsx",
          `export default { title: "A/B", parameters: { propGroups: ${written} } };`
        )
      ).toBe("A.stories.tsx: the meta's `parameters.propGroups` must be written as a list of plain strings");
    }
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

  it("reads a story meant for a phone from the meta and the story, written plainly", () => {
    const text = `export default { title: "A/B", parameters: { touch: true } };
      export const Swipe = {};
      export const Desk = { parameters: { touch: false } };
`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      isTouch: true,
      stories: [{ exportName: "Swipe" }, { exportName: "Desk", isTouch: false }]
    });
  });

  it("reads a story about logic from the meta and the story, written plainly", () => {
    const text = `export default { title: "Hooks/useUndo", parameters: { logic: true } };
      export const History = {};
      export const Looks = { parameters: { logic: false } };
`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "Hooks/useUndo",
      isLogic: true,
      stories: [{ exportName: "History" }, { exportName: "Looks", isLogic: false }]
    });
  });

  it("reads the device a meta and a story are shown in, written plainly", () => {
    const text = `export default { title: "A/B", parameters: { device: { frame: true, model: "iphone-16" } } };
      export const Phone = {};
      export const Turned = { parameters: { device: { orientation: "landscape" as const } } };
      export const Off = { parameters: { device: { frame: false } } };
      export const Mouse = { parameters: { device: { touch: false } } };
`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      device: { frame: true, model: "iphone-16" },
      stories: [
        { exportName: "Phone" },
        { exportName: "Turned", device: { orientation: "landscape" } },
        { exportName: "Off", device: { frame: false } },
        { exportName: "Mouse", device: { touch: false } }
      ]
    });
  });

  it("refuses a device written by code, with a field it has not, or naming a model or orientation that is none", () => {
    const index = (device: string): unknown =>
      indexStoryFile(
        "A.stories.tsx",
        `export default { title: "A/B" };\nexport const X = { parameters: { device: ${device} } };`
      );
    expect(index("PHONE")).toMatch(/story X: `parameters.device` must be written as a plain object/);
    expect(index("{ size: 3 }")).toMatch(
      /`parameters.device` has no field `size`: it takes frame, model, orientation, touch and edgeToEdge/
    );
    expect(index('{ model: "nokia-3310" }')).toMatch(/`parameters.device`: "nokia-3310" is no device model/);
    expect(index('{ orientation: "flat" }')).toMatch(/"flat" is no orientation/);
    expect(index("{ frame: 1 }")).toMatch(
      /`parameters.device.frame` must be written as a plain `true` or `false`/
    );
  });

  it("refuses touch and logic written by code: only the index reads them, so they must be plain", () => {
    expect(
      indexStoryFile(
        "A.stories.tsx",
        'export default { title: "A/B" };\nexport const X = { parameters: { logic: IS_LOGIC } };'
      )
    ).toBe("A.stories.tsx: story X: `parameters.logic` must be written as a plain `true` or `false`");
    expect(
      indexStoryFile(
        "A.stories.tsx",
        'export default { title: "A/B", parameters: { touch: "yes" } };\nexport const X = {};'
      )
    ).toBe("A.stories.tsx: the meta's `parameters.touch` must be written as a plain `true` or `false`");
  });

  it("reads a design from the meta and a story, written plainly, and checks it", () => {
    const text = `export default { title: "A/B", parameters: { design: { figma: "https://www.figma.com/design/F/A" } } };
      export const X = { parameters: { design: { figma: "https://www.figma.com/design/F/A?node-id=1-2" } } };
      export const Y = {};`;
    expect(indexStoryFile("A.stories.tsx", text)).toEqual({
      title: "A/B",
      design: { url: "https://www.figma.com/design/F", kind: "design", fileKey: "F" },
      stories: [
        {
          exportName: "X",
          design: {
            url: "https://www.figma.com/design/F?node-id=1-2",
            kind: "design",
            fileKey: "F",
            nodeId: "1:2"
          }
        },
        { exportName: "Y" }
      ]
    });
  });

  it("notes a link that is not Figma's and keeps the file, with no design", () => {
    const text = `export default { title: "A/B", parameters: { design: { figma: "https://figma.evil.example/design/F" } } };
      export const X = { parameters: { design: { figma: "javascript:alert(1)" } } };
      export const Y = {};`;
    const index = indexStoryFile("A.stories.tsx", text);
    if (typeof index === "string") throw new Error(index);
    expect(index.design).toBeUndefined();
    expect(index.stories).toEqual([{ exportName: "X", design: null }, { exportName: "Y" }]);
    expect(index.notes).toEqual([
      '`parameters.design.figma`: "https://figma.evil.example/design/F" is not a link to figma.com',
      'story X: `parameters.design.figma`: "javascript:alert(1)" is not a link to figma.com'
    ]);
  });

  it("refuses a Figma link written by code, which only the index reads, and leaves another tool's design alone", () => {
    expect(
      indexStoryFile(
        "A.stories.tsx",
        'export default { title: "A/B" }; export const X = { parameters: { design: { figma: LINK } } };'
      )
    ).toBe("A.stories.tsx: story X: `parameters.design.figma` must be written as a plain string");
    expect(
      indexStoryFile(
        "A.stories.tsx",
        `export default { title: "A/B", parameters: { design: { type: "figma", url: "https://example.com" } } };
         export const X = { parameters: { design: [{ type: "figma", url: "https://example.com" }] } };`
      )
    ).toEqual({ title: "A/B", stories: [{ exportName: "X" }] });
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
