/**
 * Tests for the story tree: ids, names, the places titles give, and the problems.
 *
 * @module
 */

import type { StoryFiles, StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import {
  componentId,
  findComponent,
  findStory,
  groupedStories,
  kebab,
  mainStory,
  sidebarStoryIds,
  storyId,
  storyName,
  storyTree,
  type TreeFamily,
  testedStoryLocations
} from "../src/storyTree.ts";

/** The story groups a design system's catalogue names, in their order. */
const GROUPS = ["states", "motion", "in-context", "showcase", "worst-case", "behaviour"];

/** A source with the given files, no style sheets. */
const source = (index: StoryFiles["index"], families?: readonly string[]): StorySource => ({
  id: "kit",
  name: "Kit",
  ...(families === undefined ? {} : { families }),
  files: [{ index, stories: {}, docs: {}, code: {}, pages: {} }],
  sheets: { required: [], theme: [], restyled: [] }
});

describe("ids and names", () => {
  it("writes ids in kebab case, as CSF does, with the source's id first", () => {
    expect(kebab("Inputs/Selection/Select")).toBe("inputs-selection-select");
    expect(kebab("KeyboardOpen")).toBe("keyboard-open");
    expect(storyId("kit", "Actions/Button", "DangerSmall")).toBe("kit:actions-button--danger-small");
  });

  it("names a story from its export in sentence case", () => {
    expect(storyName("KeyboardOpen")).toBe("Keyboard open");
    expect(storyName("Overview")).toBe("Overview");
    expect(storyName("Size2X")).toBe("Size 2 x");
  });
});

describe("storyTree", () => {
  const tree = storyTree([
    source(
      {
        "./b.stories.tsx": { title: "Inputs/Selection/Select", stories: [{ exportName: "Overview" }] },
        "./a.stories.tsx": {
          title: "Inputs/Text/TextField",
          stories: [{ exportName: "Long", name: "Long label" }]
        },
        "./c.stories.tsx": { title: "Foundations/Colour", stories: [{ exportName: "Scales" }] },
        "./d.stories.tsx": { title: "Actions/Button", stories: [{ exportName: "Overview" }] }
      },
      ["Foundations"]
    )
  ]);

  it("orders families as the source lists them, then alphabetically, and groups by the middle segment", () => {
    const [kit] = tree.sources;
    expect(kit?.families.map((family) => family.name)).toEqual(["Foundations", "Actions", "Inputs"]);
    const inputs = kit?.families[2];
    expect(inputs?.groups.map((group) => group.name)).toEqual(["Selection", "Text"]);
    expect(kit?.families[0]?.groups[0]?.name).toBeUndefined();
  });

  it("orders a family's groups as the source lists them, then alphabetically, the ungrouped first", () => {
    const ordered = storyTree([
      {
        ...source({
          "./a.stories.tsx": { title: "Inputs/Choice/Select", stories: [] },
          "./b.stories.tsx": { title: "Inputs/Text/TextField", stories: [] },
          "./c.stories.tsx": { title: "Inputs/Files/DropZone", stories: [] },
          "./d.stories.tsx": { title: "Inputs/Field", stories: [] },
          "./e.stories.tsx": { title: "Inputs/Dates/Calendar", stories: [] },
          "./f.stories.tsx": { title: "Data/Lists/List", stories: [] },
          "./g.stories.tsx": { title: "Data/Code/Diff", stories: [] }
        }),
        familyGroups: { Inputs: ["Text", "Choice", "Gone"] }
      }
    ]);
    const groupsOf = (name: string): (string | undefined)[] | undefined =>
      ordered.sources[0]?.families.find((family) => family.name === name)?.groups.map((group) => group.name);
    expect(groupsOf("Inputs")).toEqual([undefined, "Text", "Choice", "Dates", "Files"]);
    expect(groupsOf("Data")).toEqual(["Code", "Lists"]);
  });

  it("names stories from the index, with a written name winning", () => {
    expect(findStory(tree, "kit:inputs-text-text-field--long")?.story.name).toBe("Long label");
    expect(findStory(tree, "kit:inputs-selection-select--overview")?.group.name).toBe("Selection");
    expect(componentId("kit", "Inputs/Selection/Select")).toBe("kit:inputs-selection-select");
    expect(findComponent(tree, "kit:inputs-selection-select")?.component.name).toBe("Select");
    expect(findComponent(tree, "kit:inputs-selection")).toBeUndefined();
  });

  it("gives each story its controls: its own, else the meta's, else every one", () => {
    const withControls = storyTree([
      source({
        "./e.stories.tsx": {
          title: "Feedback/Skeleton",
          controls: ["isLoading"],
          stories: [{ exportName: "Overview", controls: [] }, { exportName: "Rows" }]
        },
        "./f.stories.tsx": { title: "Feedback/Counter", stories: [{ exportName: "Plain" }] }
      })
    ]);
    expect(findStory(withControls, "kit:feedback-skeleton--overview")?.story.controls).toEqual([]);
    expect(findStory(withControls, "kit:feedback-skeleton--rows")?.story.controls).toEqual(["isLoading"]);
    expect(findStory(withControls, "kit:feedback-counter--plain")?.story.controls).toBe("all");
  });

  it("gives each story the height its scene needs: its own, else the meta's", () => {
    const tall = storyTree([
      source({
        "./h.stories.tsx": {
          title: "Overlays/Menu",
          height: 240,
          stories: [{ exportName: "Open", height: 360 }, { exportName: "Closed" }]
        },
        "./n.stories.tsx": { title: "Overlays/Tip", stories: [{ exportName: "Plain" }] }
      })
    ]);
    expect(findStory(tall, "kit:overlays-menu--open")?.story.height).toBe(360);
    expect(findStory(tall, "kit:overlays-menu--closed")?.story.height).toBe(240);
    expect(findStory(tall, "kit:overlays-tip--plain")?.story.height).toBeUndefined();
  });

  it("takes as the component's demo the story marked main, else Overview, else the first", () => {
    const demos = storyTree([
      source({
        "./m.stories.tsx": {
          title: "A/Marked",
          stories: [{ exportName: "Overview" }, { exportName: "Rows", isMain: true }]
        },
        "./o.stories.tsx": {
          title: "A/Plain",
          stories: [{ exportName: "Rows" }, { exportName: "Overview" }]
        },
        "./f.stories.tsx": { title: "A/First", stories: [{ exportName: "Rows" }, { exportName: "Long" }] }
      })
    ]);
    const demoOf = (id: string): string | undefined => {
      const location = findComponent(demos, id);
      return location === undefined ? undefined : mainStory(location.component)?.exportName;
    };
    expect(demoOf("kit:a-marked")).toBe("Rows");
    expect(demoOf("kit:a-plain")).toBe("Overview");
    expect(demoOf("kit:a-first")).toBe("Rows");
  });

  it("passes each story's group and description on, and orders the stories by group", () => {
    const grouped = storyTree([
      source({
        "./g.stories.tsx": {
          title: "Feedback/Skeleton",
          stories: [
            { exportName: "Long", group: "worst-case", description: "Hard names." },
            { exportName: "Overview" },
            { exportName: "Chat", group: "in-context" },
            { exportName: "Rows" },
            { exportName: "Arrival", group: "states" }
          ]
        }
      })
    ]);
    const component = findStory(grouped, "kit:feedback-skeleton--long")?.component;
    expect(findStory(grouped, "kit:feedback-skeleton--long")?.story.description).toBe("Hard names.");
    expect(
      groupedStories(component?.stories ?? [], GROUPS).map((section) => [
        section.group,
        section.stories.map((story) => story.exportName)
      ])
    ).toEqual([
      [undefined, ["Overview", "Rows"]],
      ["states", ["Arrival"]],
      ["in-context", ["Chat"]],
      ["worst-case", ["Long"]]
    ]);
    // the keys walk the stories as the sidebar lists them, not in the order of the file
    expect(sidebarStoryIds(grouped, GROUPS)).toEqual([
      "kit:feedback-skeleton--overview",
      "kit:feedback-skeleton--rows",
      "kit:feedback-skeleton--arrival",
      "kit:feedback-skeleton--chat",
      "kit:feedback-skeleton--long"
    ]);
  });

  it("places Storybook's titles of any depth", () => {
    const deep = storyTree([
      source({
        "./x.stories.tsx": { title: "Lonely", stories: [] },
        "./y.stories.tsx": { title: "Atoms/Forms/Inputs/Field", stories: [] }
      })
    ]);
    expect(deep.problems).toEqual([]);
    const places = deep.sources[0]?.families.map((family) => ({
      family: family.name,
      groups: family.groups.map((group) => ({
        group: group.name,
        components: group.components.map((component) => component.name)
      }))
    }));
    expect(places).toEqual([
      { family: "Atoms", groups: [{ group: "Forms / Inputs", components: ["Field"] }] },
      { family: "Lonely", groups: [{ group: undefined, components: ["Lonely"] }] }
    ]);
  });

  it("reports what the index noted, and keeps the file", () => {
    const noted = storyTree([
      source({ "./x.stories.tsx": { title: "A/X", notes: ["its title is written by code"], stories: [] } })
    ]);
    expect(noted.problems).toEqual(["Kit: ./x.stories.tsx: its title is written by code"]);
    expect(noted.sources[0]?.families[0]?.groups[0]?.components.map((component) => component.name)).toEqual([
      "X"
    ]);
  });

  it("leaves out and reports titles it cannot place and titles used twice", () => {
    const broken = storyTree([
      source({
        "./y.stories.tsx": { title: "A//D", stories: [] },
        "./z.stories.tsx": { title: "A/B", stories: [] },
        "./w.stories.tsx": { title: "A/B", stories: [] }
      })
    ]);
    expect(broken.problems).toEqual([
      'Kit: ./y.stories.tsx: "A//D" has an empty segment',
      'Kit: ./w.stories.tsx and ./z.stories.tsx have the same title "A/B"'
    ]);
    expect(broken.sources[0]?.families[0]?.groups[0]?.components.map((component) => component.file)).toEqual([
      "./z.stories.tsx"
    ]);
  });
});

describe("aliases and related components", () => {
  const tree = storyTree([
    source({
      "./table.stories.tsx": { title: "Data/Tables/Table", stories: [{ exportName: "Overview" }] },
      "./grid.stories.tsx": { title: "Data/Tables/DataGrid", stories: [{ exportName: "Overview" }] },
      "./data-table.stories.tsx": {
        title: "Recipes/DataTable",
        alsoIn: ["Data/Tables", "Lists"],
        related: ["Data/Tables/Table"],
        stories: [{ exportName: "Overview" }, { exportName: "Sorted" }]
      },
      "./stack.stories.tsx": {
        title: "Layout/Stack",
        related: ["Layout/Inline"],
        stories: [{ exportName: "Overview" }]
      },
      "./inline.stories.tsx": {
        title: "Layout/Inline",
        keywords: ["horizontal", "row"],
        stories: [{ exportName: "Overview" }]
      }
    })
  ]);
  const family = (name: string): TreeFamily | undefined =>
    tree.sources[0]?.families.find((candidate) => candidate.name === name);

  it("lists a component in its other places as an alias of its page, never as a second component", () => {
    const tables = family("Data")?.groups.find((group) => group.name === "Tables");
    expect(tables?.components.map((component) => component.name)).toEqual(["DataGrid", "Table"]);
    expect(tables?.aliases).toEqual([{ name: "DataTable", title: "Recipes/DataTable" }]);
    // a place may be a family alone, which then holds only the alias
    expect(family("Lists")?.groups).toEqual([
      { name: undefined, components: [], aliases: [{ name: "DataTable", title: "Recipes/DataTable" }] }
    ]);
    // one story per export: the alias adds no story, so no second test or image
    expect(sidebarStoryIds(tree, GROUPS).filter((id) => id.startsWith("kit:recipes-data-table"))).toEqual([
      "kit:recipes-data-table--overview",
      "kit:recipes-data-table--sorted"
    ]);
    expect(findComponent(tree, "kit:recipes-data-table")?.component.alsoIn).toEqual(["Data/Tables", "Lists"]);
    expect(tree.problems).toEqual([]);
  });

  it("keeps a component's search words, none when its meta sets none", () => {
    expect(findComponent(tree, "kit:layout-inline")?.component.keywords).toEqual(["horizontal", "row"]);
    expect(findComponent(tree, "kit:layout-stack")?.component.keywords).toEqual([]);
  });

  it("links related components both ways, by name", () => {
    expect(findComponent(tree, "kit:layout-stack")?.component.related).toEqual(["Layout/Inline"]);
    expect(findComponent(tree, "kit:layout-inline")?.component.related).toEqual(["Layout/Stack"]);
    expect(findComponent(tree, "kit:data-tables-table")?.component.related).toEqual(["Recipes/DataTable"]);
    expect(findComponent(tree, "kit:data-tables-data-grid")?.component.related).toEqual([]);
  });

  it("reports a place it cannot use and a related title that names nothing", () => {
    const broken = storyTree([
      source({
        "./a.stories.tsx": {
          title: "Data/Tables/Table",
          alsoIn: ["Data/Tables", "A/B/C", "Recipes/"],
          related: ["Data/Tables/Table", "Data/Gone"],
          stories: []
        },
        "./b.stories.tsx": { title: "Recipes/Table", alsoIn: ["Data/Tables"], stories: [] }
      })
    ]);
    expect(broken.problems).toEqual([
      "Kit: ./a.stories.tsx names itself as related",
      'Kit: ./a.stories.tsx names "Data/Gone" as related: no such title',
      'Kit: ./a.stories.tsx is also in "Data/Tables", its own place',
      'Kit: ./a.stories.tsx: also in "A/B/C" is not Family or Family/Group',
      'Kit: ./a.stories.tsx: also in "Recipes/" has an empty segment',
      'Kit: ./b.stories.tsx is also in "Data/Tables", which already lists a Table'
    ]);
  });
});

describe("tags", () => {
  const tagged = storyTree([
    source({
      "./x.stories.tsx": {
        title: "A/X",
        stories: [
          { exportName: "Shown", tags: ["autodocs"] },
          { exportName: "Hidden", tags: ["!dev"] },
          { exportName: "Untested", tags: ["!test"] }
        ]
      }
    })
  ]);
  const component = tagged.sources[0]?.families[0]?.groups[0]?.components[0];

  it("lists no story tagged !dev, which still opens by its address", () => {
    expect(component?.stories.map((story) => story.exportName)).toEqual(["Shown", "Untested"]);
    expect(component?.unlisted.map((story) => story.exportName)).toEqual(["Hidden"]);
    expect(findStory(tagged, "kit:a-x--hidden")?.story.exportName).toBe("Hidden");
  });

  it("tests every story but those tagged !test", () => {
    expect(testedStoryLocations(tagged).map((location) => location.story.exportName)).toEqual([
      "Shown",
      "Hidden"
    ]);
  });
});
