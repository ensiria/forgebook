/**
 * Tests for `forgebook-docs` on React components: the fixture package's CATALOG.md, its components read by the React
 * docs module.
 *
 * @module
 */

import { collectDocs } from "forgebook/catalogue-docs";
import { catalogueMarkdown } from "forgebook/catalogue-markdown";
import { describe, expect, it } from "vitest";

import { extractStoryComponent } from "../src/vite/extractDocs";
import { KIT_DIR } from "./fixturePaths";

/** The fixture package, a workspace package of the core's tests. */
const KIT: string = KIT_DIR;

describe("collectDocs and catalogueMarkdown", () => {
  const { data, problems } = collectDocs(KIT, extractStoryComponent);
  const text = catalogueMarkdown(data);

  it("reads the components with stories, the modules, the Sass modules and the style sheets, not the stories export", () => {
    expect(problems).toEqual([]);
    expect(data.components.map((component) => [component.title, component.subpath])).toEqual([
      ["Inputs/Selection/Select", "./select"]
    ]);
    // the kit's preset is one of its modules too, as a library's `./forgebook` is
    expect(data.modules.map((module) => module.subpath)).toEqual(["./utils/format-size", "./forgebook"]);
    expect(data.sassModules.map((module) => module.subpath)).toEqual(["./scss/ring"]);
    expect(data.styleSheets).toEqual([{ subpath: "./kit.css", summary: "The fixture kit's style sheet." }]);
  });

  it("writes one dense line per entry", () => {
    expect(text).toContain("### Inputs › Selection");
    expect(text).toContain(
      "- **Select** `@fixture/kit/select`: Lets the user pick one value from a list. value:string size=sm|md*|lg rows:number isDisabled onValueChange(value) options!:readonly string[] hint:ReactNode · parts: root, trigger, list"
    );
    expect(text).toContain(
      "- `@fixture/kit/utils/format-size` formatSize(value, unit?): A size written with its unit. Also: formatSizeOf(size), SIZES, types SizeUnit"
    );
    expect(text).toContain(
      "- `ring`: ring($color, $width): A ring around a part, drawn as a box shadow, in the given colour; double($length): Twice a length"
    );
    expect(text).toContain("- `@fixture/kit/kit.css`: The fixture kit's style sheet.");
    expect(text).not.toContain("Page");
  });

  it("writes each family's ungrouped components first, then its groups, each heading once", () => {
    const [select] = data.components;
    if (select === undefined) throw new Error("the fixture kit has no component");
    const titled = ["Data/Lists/List", "Data/Value", "Data/Code/Diff", "Data/Board", "Actions/Button"].map(
      (title) => ({ ...select, title, name: title.split("/").at(-1) ?? title })
    );
    const headings = catalogueMarkdown({ ...data, components: titled })
      .split("\n")
      .filter((line) => line.startsWith("### "));
    expect(headings).toEqual(["### Actions", "### Data", "### Data › Code", "### Data › Lists"]);
  });
});
