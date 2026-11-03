/**
 * Tests for `forgebook docs` on React components: the fixture package's CATALOG.md, its components read by the React
 * docs module.
 *
 * @module
 */

import { collectDocs } from "forgebook/catalogue-docs";
import { catalogueMarkdown } from "forgebook/catalogue-markdown";
import { CATALOGUE_SECTIONS } from "forgebook/catalogue-options";
import { describe, expect, it } from "vitest";

import { extractStoryComponent } from "../src/vite/extractDocs.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** The fixture package, a workspace package of the core's tests. */
const KIT: string = KIT_DIR;

describe("collectDocs and catalogueMarkdown", () => {
  const { data, problems } = collectDocs(KIT, extractStoryComponent, { exclude: [] });
  const text = catalogueMarkdown(data, CATALOGUE_SECTIONS);

  it("reads the components with stories, the modules, the Sass modules and the style sheets, not the stories export", () => {
    expect(problems).toEqual([]);
    expect(data.components.map((component) => [component.title, component.subpath])).toEqual([
      ["Inputs/Selection/Select", "./select"],
      ["Hooks/useUndo", "./use-undo"]
    ]);
    // the kit's preset is one of its modules too, as a library's `./forgebook` is
    expect(data.modules.map((module) => module.subpath)).toEqual(["./utils/format-size", "./forgebook"]);
    expect(data.sassModules.map((module) => module.subpath)).toEqual(["./scss/ring"]);
    expect(data.styleSheets).toEqual([{ subpath: "./kit.css", summary: "The fixture kit's style sheet." }]);
  });

  it("writes one dense line per entry", () => {
    expect(text).toContain("### Inputs › Selection");
    expect(text).toContain(
      "- **Select** `@fixture/kit/select`: Lets the user pick one value from a list. value:string size=sm|md*|lg rows:number isDisabled onValueChange(value) options!:readonly string[] hint:ReactNode · parts: root, trigger, list · story: `kit:inputs-selection-select--in-row`"
    );
    expect(text).toContain(
      "- `@fixture/kit/utils/format-size` formatSize(value, unit?): A size written with its unit. Also: formatSizeOf(size), SIZES, types SizeUnit"
    );
    expect(text).toContain(
      "- `ring`: ring($color, $width): A ring around a part, drawn as a box shadow, in the given colour; double($length): Twice a length"
    );
    expect(text).toContain("- `@fixture/kit/kit.css`: The fixture kit's style sheet.");
    // a hook with stories about logic: its call, not its options as props
    expect(text).toContain(
      "- **useUndo** `@fixture/kit/use-undo`: Keeps a value with its history. useUndo<TValue>(initial, limit?): UndoState<TValue> · story: `kit:hooks-useundo--history`"
    );
    expect(text).not.toContain("Page");
  });

  it("writes each family's ungrouped components first, then its groups, each heading once", () => {
    const [select] = data.components;
    if (select === undefined) throw new Error("the fixture kit has no component");
    const titled = ["Data/Lists/List", "Data/Value", "Data/Code/Diff", "Data/Board", "Actions/Button"].map(
      (title) => ({ ...select, title, name: title.split("/").at(-1) ?? title })
    );
    const headings = catalogueMarkdown({ ...data, components: titled }, ["components"])
      .split("\n")
      .filter((line) => line.startsWith("### "));
    expect(headings).toEqual(["### Actions", "### Data", "### Data › Code", "### Data › Lists"]);
  });

  it("lists the source's tokens by type, with their themes, alias, purpose and deprecation", () => {
    expect(problems).toEqual([]);
    expect(data.tokens.map((token) => token.name)).toEqual([
      "color.brand",
      "color.action",
      "color.old",
      "space.sm"
    ]);
    expect(text).toContain("## Tokens");
    expect(text).toContain("- `color.brand`: `#1c1b1b` · dark `#f4f1ea` · The brand's colour");
    expect(text).toContain("- `color.action`: `#1c1b1b` · dark `#f4f1ea` · alias of `color.brand`");
    expect(text).toContain("- `color.old`: `#333333` · deprecated: Use color.action");
    expect(text).toContain("### dimension\n- `space.sm`: `8px`");
  });

  it("keeps a token on its line, whatever its file holds", () => {
    const [first] = data.tokens;
    if (first === undefined) throw new Error("the fixture kit has no token");
    const forged = { ...first, name: "a\n## Forged", value: "x\n## Forged", type: "t\n## Forged" };
    const written = catalogueMarkdown({ ...data, tokens: [forged] }, ["tokens"]);
    expect(written.split("\n").filter((line) => line.startsWith("## "))).toEqual(["## Tokens"]);
  });

  it("leaves the tokens unread when the sections do not list them", () => {
    const listed = collectDocs(KIT, extractStoryComponent, { exclude: [], sections: ["components"] });
    expect(listed.data.tokens).toEqual([]);
  });

  it("reads the source's id from the stories export, and each component's main story", () => {
    expect(data.sourceId).toBe("kit");
    expect(data.components[0]?.mainStory).toBe("InRow");
    expect(data.components[0]?.mainStoryId).toBe("inputs-selection-select--in-row");
  });

  it("leaves out the excluded subpaths and writes the sections asked for, in their order", () => {
    const excluded = collectDocs(KIT, extractStoryComponent, { exclude: ["./utils/*", "./select"] }).data;
    expect(excluded.components.map((component) => component.subpath)).toEqual(["./use-undo"]);
    expect(excluded.modules.map((module) => module.subpath)).toEqual(["./forgebook"]);
    const headings = catalogueMarkdown(data, ["styleSheets", "components"])
      .split("\n")
      .filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## Style sheets", "## Components"]);
  });
});
