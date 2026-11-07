/**
 * Tests for what hides a published component from an agent: which source files a package publishes, which of their
 * exports read as components, and what each finding says.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { type SeenComponent, unseenComponent } from "../src/vite/agentVisibility.ts";
import { type EntryDisk, isPublished, packageEntries } from "../src/vite/packageEntries.ts";
import { type ExportsDisk, type PublishedFile, publishedComponents } from "../src/vite/publishedExports.ts";
import { filesOfChange } from "../src/vite/visibilityRoute.ts";

const diskOf = (files: Readonly<Record<string, string>>): ExportsDisk => ({
  readText: (file: string): string | undefined => files[file],
  resolve: (specifier: string, from: string): string | undefined => {
    const bare = `${from.split("/").slice(0, -1).join("/")}/${specifier.replace(/^\.\//, "")}`;
    return [`${bare}.ts`, `${bare}.tsx`, `${bare}.js`, `${bare}/index.ts`].find(
      (each) => files[each] !== undefined
    );
  }
});

const BUTTON: PublishedFile = {
  file: "/r/src/Button.tsx",
  names: ["Button"],
  takesProps: true,
  hasComment: false
};

const seen = (extra: Partial<SeenComponent>): SeenComponent => ({
  title: "Actions/Button",
  storyFile: "./src/Button.stories.tsx",
  words: ["Plain"],
  listed: 1,
  unlisted: 0,
  metaFile: "/r/src/Button.tsx",
  reached: ["/r/src/Button.stories.tsx", "/r/src/Button.tsx"],
  storyText: "",
  docs: { props: 2, hasText: true, subcomponents: [] },
  description: undefined,
  ...extra
});

const missing = (components: readonly SeenComponent[], file: PublishedFile = BUTTON): readonly string[] =>
  unseenComponent(file, "src/Button.tsx", "src/Button.tsx", components)?.reasons.map(
    (each) => each.missing
  ) ?? [];

describe("packageEntries", () => {
  const disk = (files: readonly string[]): EntryDisk => ({
    exists: (file: string): boolean => files.includes(file),
    filesUnder: (folder: string): readonly string[] => files.filter((file) => file.startsWith(`${folder}/`))
  });

  it("leads a built entry back to its source", () => {
    const manifest = {
      name: "kit",
      exports: { ".": { import: "./dist/esm/index.js", types: "./dist/index.d.ts" } }
    };
    expect(packageEntries(manifest, "/r", disk(["/r/src/index.ts"]))).toEqual({
      entries: ["/r/src/index.ts"],
      unread: []
    });
  });

  it("names an entry it cannot lead back, rather than read it as an empty package", () => {
    expect(packageEntries({ name: "kit", main: "./dist/index.js" }, "/r", disk([])).unread).toEqual([
      "./dist/index.js"
    ]);
  });

  it("reads every entry a manifest names, and none that climbs out of the package", () => {
    const manifest = {
      name: "kit",
      source: "./src/index.ts",
      exports: { "./extra": "./src/extra.ts", "./x": "../../outside/x.ts" }
    };
    const found = packageEntries(
      manifest,
      "/r",
      disk(["/r/src/index.ts", "/r/src/extra.ts", "/outside/x.ts"])
    );
    expect(found.entries).toEqual(["/r/src/extra.ts", "/r/src/index.ts"]);
    expect(found.unread).toEqual(["../../outside/x.ts"]);
  });

  it("leaves stories and tests out of what a pattern stands for", () => {
    const files = ["/r/src/Button.tsx", "/r/src/Button.stories.tsx", "/r/src/Button.test.tsx"];
    expect(
      packageEntries({ name: "kit", exports: { "./*": "./dist/*.js" } }, "/r", disk(files)).entries
    ).toEqual(["/r/src/Button.tsx"]);
  });

  it("holds an application to nothing, and a private library with entries to the rule", () => {
    expect(isPublished({ name: "app", private: true })).toBe(false);
    expect(isPublished({ name: "ui", private: true, exports: "./src/index.ts" })).toBe(true);
    expect(isPublished({ name: "kit" })).toBe(true);
  });
});

describe("publishedComponents", () => {
  it("follows barrels to the file that declares each, and leaves out what is no component", () => {
    const found = publishedComponents(
      ["/r/src/index.ts"],
      diskOf({
        "/r/src/index.ts": `export * from "./Button";\nexport { Card as Tile } from "./Card";\nexport type { Hidden } from "./Hidden";\nexport * from "./values";\n`,
        "/r/src/Button.tsx": `export const Button = (props: { label: string }) => <button>{props.label}</button>;\nexport const ButtonContext = createContext(null);\nexport const useButton = () => 1;\nexport const SIZES = ["s"];\n`,
        "/r/src/Card.tsx": "/** A card. */\nexport const Card = () => <div />;\n",
        "/r/src/Hidden.tsx": "export const Hidden = () => <div />;\n",
        "/r/src/values.ts": "export const Limit = 3;\n"
      })
    );
    expect(found).toEqual([
      { file: "/r/src/Button.tsx", names: ["Button"], takesProps: true, hasComment: false },
      { file: "/r/src/Card.tsx", names: ["Tile"], takesProps: false, hasComment: true }
    ]);
  });

  it("reads a plain script's capitalised function as no component, and a default written in place by its file", () => {
    const found = publishedComponents(
      ["/r/src/index.ts"],
      diskOf({
        "/r/src/index.ts": `export { default as Format } from "./format";\nexport { default as Alert } from "./Alert";\nexport { Tooltip } from "./Tooltip";\n`,
        "/r/src/format.ts": "export default function (value: number) {\n  return String(value);\n}\n",
        "/r/src/Alert.js": `export default function Alert() {\n  return <div role="alert"></div>;\n}\n`,
        "/r/src/Tooltip.tsx": `import * as P from "lib";\nexport const Tooltip = P.Root;\n`
      })
    );
    expect(found.map((each) => each.names)).toEqual([["Alert"], ["Tooltip"]]);
  });

  it("says when an export goes through an alias it cannot follow", () => {
    const aliases: string[] = [];
    const disk = {
      ...diskOf({ "/r/index.ts": `export * from "@/Button";\n` }),
      onAlias: (name: string): void => {
        aliases.push(name);
      }
    };
    expect(publishedComponents(["/r/index.ts"], disk)).toEqual([]);
    expect(aliases).toEqual(["@/Button"]);
  });

  it("survives a cycle of barrels", () => {
    const found = publishedComponents(
      ["/r/a.ts"],
      diskOf({
        "/r/a.ts": `export * from "./b";\n`,
        "/r/b.ts": `export * from "./a";\nexport * from "./C";\n`,
        "/r/C.tsx": "export const C = () => <i />;\n"
      })
    );
    expect(found.map((each) => each.names)).toEqual([["C"]]);
  });
});

describe("filesOfChange", () => {
  const button: PublishedFile = BUTTON;
  const card: PublishedFile = { ...BUTTON, file: "/r/src/Card.tsx", names: ["Card"] };
  const nothingBefore = (): Promise<readonly PublishedFile[]> => Promise.reject(new Error("not asked"));

  it("holds the components edited, and asks nothing of the commit when only they moved", async () => {
    expect(await filesOfChange([button, card], ["/r/src/Button.tsx"], nothingBefore)).toEqual([button]);
  });

  it("holds a component whose story file moved or went, though its own file did not", async () => {
    expect(await filesOfChange([button, card], ["/r/src/Card.stories.tsx"], nothingBefore)).toEqual([card]);
    const box = { ...BUTTON, file: "/r/src/Box/Box.js", names: ["Box"] };
    expect(await filesOfChange([box], ["/r/src/Box/stories/Simple.stories.js"], nothingBefore)).toEqual([
      box
    ]);
  });

  it("holds a name a barrel starts exporting, and no name it already did", async () => {
    const before = async (): Promise<readonly PublishedFile[]> => [button];
    expect(await filesOfChange([button, card], ["/r/src/index.ts"], before)).toEqual([card]);
  });
});

describe("unseenComponent", () => {
  it("passes a component with a listed story, props and TSDoc", () => {
    expect(missing([seen({})])).toEqual([]);
  });

  it("names a component only other stories draw, the case a duplicate comes from", () => {
    const other = seen({
      title: "Forms/Search",
      metaFile: "/r/src/Search.tsx",
      reached: ["/r/src/Button.tsx"]
    });
    expect(missing([other])).toEqual(["story"]);
  });

  it("names stories all tagged !dev", () => {
    expect(missing([seen({ listed: 0, unlisted: 2 })])).toEqual(["listed-story"]);
  });

  it("names a meta with no component, and claims nothing of a TSDoc it could not read", () => {
    expect(missing([seen({ metaFile: undefined, docs: undefined })])).toEqual(["props"]);
  });

  it("names props that could not be read, only when the component plainly takes some", () => {
    const empty = seen({ docs: { props: 0, hasText: true, subcomponents: [] } });
    expect(missing([empty])).toEqual(["props"]);
    expect(missing([empty], { ...BUTTON, takesProps: false })).toEqual([]);
  });

  it("names no TSDoc, and accepts one on the declaration or the meta's description", () => {
    const silent = seen({ docs: { props: 2, hasText: false, subcomponents: [] } });
    expect(missing([silent])).toEqual(["tsdoc"]);
    expect(missing([silent], { ...BUTTON, hasComment: true })).toEqual([]);
    expect(missing([{ ...silent, description: "Saves." }])).toEqual([]);
  });

  it("takes a part as seen on the page of the component it is named after, when its stories reach it", () => {
    const part = { ...BUTTON, file: "/r/src/ButtonIcon.tsx", names: ["ButtonIcon"] };
    expect(missing([seen({ reached: ["/r/src/ButtonIcon.tsx"] })], part)).toEqual([]);
    expect(missing([seen({})], part)).toEqual(["story"]);
  });

  it("takes a part its component's stories name, when the graph cannot follow them", () => {
    const part = { ...BUTTON, file: "/r/src/TableRow/TableRow.js", names: ["TableRow"] };
    const table = seen({
      title: "Data/Table/Simple",
      metaFile: undefined,
      reached: [],
      storyText: "<TableRow />"
    });
    expect(missing([table], part)).toEqual([]);
    expect(missing([{ ...table, storyText: "<TableRowish />" }], part)).toEqual(["story"]);
  });

  it("takes a story named after a component for a story about it", () => {
    const token = { ...BUTTON, file: "/r/src/IssueLabelToken.tsx", names: ["IssueLabelToken"] };
    const stories = seen({
      title: "Components/Token",
      metaFile: undefined,
      reached: [],
      words: ["DefaultIssueLabelToken"]
    });
    expect(unseenComponent(token, "a", "a", [stories])?.reasons.map((each) => each.missing)).not.toContain(
      "story"
    );
  });

  it("takes nothing for a part from a name alone, nor from a title it cannot read", () => {
    const group = { ...BUTTON, file: "/r/src/ButtonGroup.tsx", names: ["ButtonGroup"] };
    expect(missing([seen({})], group)).toEqual(["story"]);
    const reached = seen({ title: "Forms/TextField", metaFile: undefined, reached: ["/r/src/Text.tsx"] });
    expect(missing([reached], { ...BUTTON, file: "/r/src/Text.tsx", names: ["Text"] })).toEqual(["story"]);
    const foreign = seen({ title: "组件/按钮", metaFile: undefined, reached: ["/r/src/Other.tsx"] });
    expect(missing([foreign], { ...BUTTON, file: "/r/src/Other.tsx", names: ["Other"] })).toEqual(["story"]);
  });

  it("reads a part's component from any title part but its section", () => {
    const part = { ...BUTTON, file: "/r/src/TableBody/TableBody.js", names: ["TableBody"] };
    // a JavaScript library's import, in the form the graph leaves it
    const reached = ["/r/src/TableBody"];
    const table = seen({ title: "Visualizations/Table/Simple", metaFile: undefined, reached });
    expect(missing([table], part)).toEqual([]);
    const section = seen({ title: "Table/Simple", metaFile: undefined, reached });
    expect(missing([section], part)).toEqual(["story"]);
  });

  it("takes the declaration file beside a JavaScript component for it", () => {
    const box = { ...BUTTON, file: "/r/src/Box/Box.js", names: ["Box"] };
    const stories = seen({ title: "Layout/Box/Simple", metaFile: "/r/src/Box/index.d.ts", reached: [] });
    expect(missing([stories], box)).toEqual([]);
  });

  it("owes no story for a provider", () => {
    const provider = { ...BUTTON, file: "/r/src/ThemeProvider.tsx", names: ["ThemeProvider"] };
    expect(missing([seen({})], provider)).toEqual([]);
  });

  it("does not take another package's component of the same name for this one", () => {
    const wrapper = { ...BUTTON, file: "/r/other/src/Button.tsx" };
    expect(missing([seen({ metaFile: undefined })], wrapper)).toEqual(["story"]);
  });

  it("gives the fix as a command that keeps a file name as one word and text", () => {
    const fixOf = (path: string): string | undefined =>
      unseenComponent(BUTTON, path, path, [])?.reasons[0]?.fix;
    expect(fixOf("-odd/Button.tsx")).toBe("npx forgebook new ./-odd/Button.tsx");
    expect(fixOf("src/$(touch PWNED).tsx")).toBe("npx forgebook new 'src/$(touch PWNED).tsx'");
  });

  it("takes a component declared in a package's build for its source", () => {
    const stories = seen({ metaFile: "/r/dist/Button.d.ts", docs: undefined });
    expect(missing([stories])).toEqual([]);
  });
});
