/**
 * Tests for the story tree: ids, names, the places titles give, and the problems.
 *
 * @module
 */

import type { FigmaLink, StoryFiles, StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import {
  componentId,
  findComponent,
  findComponentByTitle,
  findStory,
  formerStoryId,
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
  it("writes ids as Storybook does, with the source's id first", () => {
    expect(storyId("kit", "Actions/Button", "DangerSmall")).toBe("kit:actions-button--danger-small");
    // the title is lower-cased as written, never split at its case changes; the export is split into words
    expect(storyId("kit", "Disclosure/ReadMore", "Default")).toBe("kit:disclosure-readmore--default");
    expect(componentId("kit", "Disclosure/ReadMore")).toBe("kit:disclosure-readmore");
    expect(storyId("kit", "A/B", "PaddingInherit1")).toBe("kit:a-b--padding-inherit-1");
    expect(storyId("kit", "A/B", "HTMLButton")).toBe("kit:a-b--html-button");
    expect(storyId("kit", "A/B", "Size2X")).toBe("kit:a-b--size-2-x");
    expect(storyId("kit", "A/B", "with_snake-case.dot")).toBe("kit:a-b--with-snake-case-dot");
    // letters of any script stay, punctuation and spaces become one hyphen
    expect(storyId("kit", "Skjema/Knapp på (ny)", "ÆrligTalt")).toBe("kit:skjema-knapp-på-ny--ærlig-talt");
  });

  it("stays quick on a title that is a long run of punctuation", () => {
    const title = `${"-".repeat(200_000)}A${"/".repeat(200_000)}`;
    const started = performance.now();
    expect(componentId("kit", title)).toBe("kit:a");
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("keeps the former ids' rule, which split titles at their case changes", () => {
    expect(kebab("Inputs/Selection/Select")).toBe("inputs-selection-select");
    expect(kebab("ReadMore")).toBe("read-more");
    expect(formerStoryId("kit", "Disclosure/ReadMore", "Size2X")).toBe("kit:disclosure-read-more--size2-x");
  });

  it("names a story from its export in sentence case", () => {
    expect(storyName("KeyboardOpen")).toBe("Keyboard open");
    expect(storyName("Overview")).toBe("Overview");
    expect(storyName("Size2X")).toBe("Size 2 X");
    // split into words as Storybook splits an export, a word written in capitals kept so
    expect(storyName("CustomSVGIcon")).toBe("Custom SVG icon");
    expect(storyName("XSmall")).toBe("X small");
    expect(storyName("WithHGrid")).toBe("With H grid");
    expect(storyName("A11yTest")).toBe("A 11 y test");
    expect(storyName("with_snake-case.dot")).toBe("With snake case dot");
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

  it("marks a story meant for a phone: its own setting, else the meta's", () => {
    const phone = storyTree([
      source({
        "./t.stories.tsx": {
          title: "Touch/List",
          isTouch: true,
          stories: [{ exportName: "Swipe" }, { exportName: "Desk", isTouch: false }]
        },
        "./d.stories.tsx": {
          title: "Touch/Plain",
          stories: [{ exportName: "Plain", isTouch: true }, { exportName: "Other" }]
        }
      })
    ]);
    expect(findStory(phone, "kit:touch-list--swipe")?.story.isTouch).toBe(true);
    expect(findStory(phone, "kit:touch-list--desk")?.story.isTouch).toBe(false);
    expect(findStory(phone, "kit:touch-plain--plain")?.story.isTouch).toBe(true);
    expect(findStory(phone, "kit:touch-plain--other")?.story.isTouch).toBe(false);
  });

  it("places a story's required props by its own setting, else its meta's; a component's page by its meta's", () => {
    const tree = storyTree([
      source({
        "./r.stories.tsx": {
          title: "Inputs/Field",
          requiredFirst: "section",
          stories: [
            { exportName: "Plain" },
            { exportName: "Grouped", requiredFirst: "in-groups" },
            { exportName: "Written", requiredFirst: false }
          ]
        },
        "./s.stories.tsx": { title: "Inputs/Other", stories: [{ exportName: "Plain" }] }
      })
    ]);
    expect(findStory(tree, "kit:inputs-field--plain")?.story.requiredFirst).toBe("section");
    expect(findStory(tree, "kit:inputs-field--grouped")?.story.requiredFirst).toBe("in-groups");
    expect(findStory(tree, "kit:inputs-field--written")?.story.requiredFirst).toBe(false);
    expect(findStory(tree, "kit:inputs-field--plain")?.component.requiredFirst).toBe("section");
    // none set: the catalogue's, which the shell reads
    expect(findStory(tree, "kit:inputs-other--plain")?.story.requiredFirst).toBeUndefined();
    expect(findStory(tree, "kit:inputs-other--plain")?.component.requiredFirst).toBeUndefined();
  });

  it("marks a story about logic: its own setting, else the meta's", () => {
    const logic = storyTree([
      source({
        "./u.stories.tsx": {
          title: "Hooks/useUndo",
          isLogic: true,
          stories: [{ exportName: "History" }, { exportName: "Looks", isLogic: false }]
        }
      })
    ]);
    expect(findStory(logic, "kit:hooks-use-undo--history")?.story.isLogic).toBe(true);
    expect(findStory(logic, "kit:hooks-use-undo--looks")?.story.isLogic).toBe(false);
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

  it("leaves out and reports titles it cannot place, and titles that make no id", () => {
    const broken = storyTree([
      source({
        "./y.stories.tsx": { title: "A//D", stories: [] },
        "./z.stories.tsx": { title: "A/B", stories: [{ exportName: "Overview" }, { exportName: "_" }] },
        "./w.stories.tsx": { title: "?/!", stories: [{ exportName: "Overview" }] }
      })
    ]);
    expect(broken.problems).toEqual([
      'Kit: ./w.stories.tsx: "?/!" makes no id: it needs a letter or a digit',
      'Kit: ./y.stories.tsx: "A//D" has an empty segment',
      "Kit: ./z.stories.tsx: story _ makes no id: its name needs a letter or a digit"
    ]);
    const [component] = broken.sources[0]?.families[0]?.groups[0]?.components ?? [];
    expect(component?.file).toBe("./z.stories.tsx");
    expect(component?.stories.map((story) => story.exportName)).toEqual(["Overview"]);
  });
});

describe("a component in several files", () => {
  const merged = storyTree([
    source({
      "./text.stories.tsx": {
        title: "Type/Text",
        description: "Text in the type scale.",
        keywords: ["copy"],
        stories: [{ exportName: "Overview" }, { exportName: "Sizes" }]
      },
      "./text-playground.stories.tsx": {
        title: "Type/Text",
        controls: ["size"],
        keywords: ["playground", "copy"],
        stories: [{ exportName: "Playground" }, { exportName: "Hidden", tags: ["!dev"] }]
      },
      "./text-qa.stories.tsx": {
        title: "Type/Text",
        stories: [{ exportName: "Sizes" }, { exportName: "Wrapping" }]
      }
    })
  ]);
  const components = merged.sources[0]?.families[0]?.groups[0]?.components ?? [];
  const [text] = components;

  it("lists one component with every file's stories, in the order of the files' paths", () => {
    expect(components).toHaveLength(1);
    expect(text?.files).toEqual([
      "./text-playground.stories.tsx",
      "./text-qa.stories.tsx",
      "./text.stories.tsx"
    ]);
    expect(text?.stories.map((story) => [story.exportName, story.file])).toEqual([
      ["Playground", "./text-playground.stories.tsx"],
      ["Sizes", "./text-qa.stories.tsx"],
      ["Wrapping", "./text-qa.stories.tsx"],
      ["Overview", "./text.stories.tsx"]
    ]);
    expect(text?.unlisted.map((story) => story.id)).toEqual(["kit:type-text--hidden"]);
  });

  it("takes the docs and the page from the first file, each meta's settings for its own stories", () => {
    expect(text?.file).toBe("./text-playground.stories.tsx");
    expect(text?.stories[0]?.controls).toEqual(["size"]);
    expect(text?.stories[3]?.controls).toBe("all");
    expect(text?.keywords).toEqual(["playground", "copy"]);
  });

  it("refuses a second story with the same id, as Storybook does, and keeps the first", () => {
    expect(merged.problems).toEqual([
      'Kit: ./text.stories.tsx: story Sizes has the id "kit:type-text--sizes" of a story in ./text-qa.stories.tsx'
    ]);
    expect(findStory(merged, "kit:type-text--sizes")?.story.file).toBe("./text-qa.stories.tsx");
  });
});

describe("ids a meta or a story writes, and former ids", () => {
  const tree = storyTree([
    source({
      "./read-more.stories.tsx": { title: "Disclosure/ReadMore", stories: [{ exportName: "OpenByDefault" }] },
      "./menu.stories.tsx": {
        title: "Navigation/Menu",
        id: "menus",
        stories: [{ exportName: "Overview" }, { exportName: "Nested", id: "menus--deep" }]
      }
    })
  ]);

  it("takes the meta's id instead of its title, and a story's own id as written", () => {
    expect(findComponentByTitle(tree, "kit", "Navigation/Menu")?.component.id).toBe("kit:menus");
    expect(findStory(tree, "kit:menus--overview")?.story.exportName).toBe("Overview");
    expect(findStory(tree, "kit:menus--deep")?.story.exportName).toBe("Nested");
    expect(findComponent(tree, "kit:menus")?.component.title).toBe("Navigation/Menu");
  });

  it("refuses an empty id a story writes, and a component id another title already has", () => {
    const clashing = storyTree([
      source({
        "./a.stories.tsx": { title: "Inputs/Read More", stories: [{ exportName: "Overview" }] },
        "./b.stories.tsx": { title: "Inputs/Read-More", stories: [{ exportName: "Open" }] },
        "./c.stories.tsx": { title: "Inputs/Badge", stories: [{ exportName: "Overview", id: "" }] }
      })
    ]);
    expect(clashing.problems).toEqual([
      'Kit: ./b.stories.tsx: "Inputs/Read-More" has the id "kit:inputs-read-more" of "Inputs/Read More"',
      "Kit: ./c.stories.tsx: story Overview writes an empty id (`parameters.__id`)"
    ]);
    const components = clashing.sources[0]?.families[0]?.groups[0]?.components ?? [];
    expect(components.map((component) => component.title)).toEqual(["Inputs/Badge", "Inputs/Read More"]);
  });

  it("still finds a story and a component by the id the former rule gave them", () => {
    expect(findStory(tree, "kit:disclosure-read-more--open-by-default")?.story.id).toBe(
      "kit:disclosure-readmore--open-by-default"
    );
    expect(findComponent(tree, "kit:disclosure-read-more")?.component.id).toBe("kit:disclosure-readmore");
    expect(findStory(tree, "kit:disclosure-readmore--open-by-default")?.story.exportName).toBe(
      "OpenByDefault"
    );
  });
});

describe("designs", () => {
  const fileLink: FigmaLink = { url: "https://www.figma.com/design/File1", kind: "design", fileKey: "File1" };
  const nodeLink: FigmaLink = { ...fileLink, url: `${fileLink.url}?node-id=1-2`, nodeId: "1:2" };

  it("gives a story the meta's design unless it has its own, and the component the meta's", () => {
    const tree = storyTree([
      source({
        "A.stories.tsx": {
          title: "Inputs/A",
          design: fileLink,
          stories: [{ exportName: "Inherits" }, { exportName: "Own", design: nodeLink }]
        }
      })
    ]);
    const component = tree.sources[0]?.families[0]?.groups[0]?.components[0];
    expect(component?.design?.url).toBe(fileLink.url);
    expect(component?.stories.map((story) => story.design?.nodeId)).toEqual([undefined, "1:2"]);
    expect(tree.problems).toEqual([]);
  });

  it("gives a story whose own link the index refused no design, not the meta's, and reports the index's note", () => {
    const tree = storyTree([
      source({
        "A.stories.tsx": {
          title: "Inputs/A",
          design: fileLink,
          notes: ['story Own: `parameters.design.figma`: "javascript:alert(1)" is not a link to figma.com'],
          stories: [{ exportName: "Inherits" }, { exportName: "Own", design: null }]
        }
      })
    ]);
    const component = tree.sources[0]?.families[0]?.groups[0]?.components[0];
    expect(component?.stories.map((story) => story.design?.url)).toEqual([fileLink.url, undefined]);
    expect(tree.problems).toEqual([
      'Kit: A.stories.tsx: story Own: `parameters.design.figma`: "javascript:alert(1)" is not a link to figma.com'
    ]);
  });

  it("gives each story of files with one title its own link, else its own file's meta's, and the component the first file's", () => {
    const otherLink: FigmaLink = {
      url: "https://www.figma.com/design/File2",
      kind: "design",
      fileKey: "File2"
    };
    const tree = storyTree([
      source({
        "./a.stories.tsx": {
          title: "Inputs/A",
          design: fileLink,
          stories: [{ exportName: "First" }, { exportName: "Refused", design: null }]
        },
        "./a2.stories.tsx": {
          title: "Inputs/A",
          design: otherLink,
          stories: [{ exportName: "More" }, { exportName: "Own", design: nodeLink }]
        }
      })
    ]);
    const component = tree.sources[0]?.families[0]?.groups[0]?.components[0];
    expect(component?.design?.url).toBe(fileLink.url);
    expect(component?.stories.map((story) => story.design?.url)).toEqual([
      fileLink.url,
      undefined,
      otherLink.url,
      nodeLink.url
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
    expect(sidebarStoryIds(tree, GROUPS).filter((id) => id.startsWith("kit:recipes-datatable"))).toEqual([
      "kit:recipes-datatable--overview",
      "kit:recipes-datatable--sorted"
    ]);
    expect(findComponent(tree, "kit:recipes-datatable")?.component.alsoIn).toEqual(["Data/Tables", "Lists"]);
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

describe("a story's device", () => {
  it("lays the story's own fields over the meta's, and has none when neither sets one", () => {
    const tree = storyTree([
      source({
        "./a.stories.tsx": {
          title: "Layouts/Screen",
          device: { frame: true, model: "iphone-16" },
          stories: [{ exportName: "Phone" }, { exportName: "Pixel", device: { model: "pixel-9" } }]
        },
        "./b.stories.tsx": { title: "Layouts/Card", stories: [{ exportName: "Plain" }] }
      })
    ]);
    const stories = tree.sources[0]?.families[0]?.groups[0]?.components.flatMap(
      (component) => component.stories
    );
    expect(stories?.map((story) => [story.exportName, story.device])).toEqual([
      ["Plain", undefined],
      ["Phone", { frame: true, model: "iphone-16" }],
      ["Pixel", { frame: true, model: "pixel-9" }]
    ]);
  });
});
