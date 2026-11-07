/**
 * Tests for the repair round of `forgebook new --repair`: what an error says a story must be drawn inside, where that
 * component is, and the rounds.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { neededWrappers, repairRounds, wrapperFor } from "../bin/forgebook/newRepair.ts";
import type { StoryWrapper } from "../bin/forgebook/newStories.ts";
import type { StoryCheckReport } from "../src/storyCheck.ts";

/** A report whose one story failed with a message, or passed. */
const report = (...messages: readonly string[]): StoryCheckReport => ({
  schema: 1,
  results: [
    {
      storyId: "s",
      view: "",
      frame: "f",
      problems: messages.map((message) => ({ kind: "frame" as const, message }))
    }
  ]
});

describe("neededWrappers", () => {
  it("reads the component the usual wordings name, once each", () => {
    expect(
      neededWrappers(
        report(
          "The story could not be shown: useSidebar must be used within a SidebarProvider. (./x.stories.tsx)",
          "`DialogClose` must be used within `Dialog`",
          "useView must be used within ViewProvider",
          "useSidebar must be used within a SidebarProvider."
        )
      )
    ).toEqual(["SidebarProvider", "Dialog", "ViewProvider"]);
  });

  it("reads react-router's wording, and leaves out the story file's own names", () => {
    expect(
      neededWrappers(
        report(
          "useNavigate() may be used only in the context of a <Router> component.",
          "x must be used within Story"
        )
      )
    ).toEqual(["Router"]);
  });

  it("leaves out a context's provider, whose value cannot be made up, and anything else", () => {
    expect(
      neededWrappers(
        report("useX must be used within MemoViewContext.Provider", "Cannot read properties of undefined")
      )
    ).toEqual([]);
  });
});

describe("wrapperFor", () => {
  it("finds the component the application exports by that name, nearest first, with its import", () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-repair-"));
    mkdirSync(join(dir, "src", "sidebar"), { recursive: true });
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { jsx: "react-jsx", strict: true, moduleResolution: "bundler", module: "esnext" },
        include: ["src"]
      })
    );
    writeFileSync(
      join(dir, "src", "sidebar", "provider.tsx"),
      "export const SidebarProvider = (props: { children?: unknown }) => <div>{String(props.children)}</div>;\n"
    );
    writeFileSync(join(dir, "src", "sidebar", "Item.tsx"), "export const Item = () => <i />;\n");
    writeFileSync(join(dir, "src", "Theme.tsx"), "const Theme = () => <b />;\nexport default Theme;\n");
    const item = join(dir, "src", "sidebar", "Item.tsx");
    const story = join(dir, "src", "sidebar", "Item.stories.tsx");
    expect(wrapperFor(item, story, "SidebarProvider")).toEqual({
      name: "SidebarProvider",
      importStatement: 'import { SidebarProvider } from "./provider";'
    });
    expect(wrapperFor(item, story, "Theme")?.importStatement).toBe('import Theme from "../Theme";');
    expect(wrapperFor(item, story, "Nowhere")).toBeUndefined();
  }, 60_000);
});

describe("repairRounds", () => {
  it("adds what each round names, outermost last found, and stops when the stories pass", async () => {
    const reports = [
      report("useItem must be used within a Menu"),
      report("Menu must be used within MenuRoot"),
      report()
    ];
    const written: string[][] = [];
    const outcome = await repairRounds({
      componentFile: "/a/Item.tsx",
      storyFile: "/a/Item.stories.tsx",
      check: async () => reports.shift() ?? report(),
      write: async (wrappers: readonly StoryWrapper[]): Promise<void> => {
        written.push(wrappers.map((each) => each.name));
      },
      find: (name: string): StoryWrapper => ({
        name,
        importStatement: `import { ${name} } from "./${name}";`
      })
    });
    expect(written).toEqual([["Menu"], ["MenuRoot", "Menu"]]);
    expect(outcome.wrappers.map((each) => each.name)).toEqual(["MenuRoot", "Menu"]);
    expect(outcome.notFound).toEqual([]);
  });

  it("names what it cannot find and writes nothing for it", async () => {
    let writes = 0;
    const outcome = await repairRounds({
      componentFile: "/a/Item.tsx",
      storyFile: "/a/Item.stories.tsx",
      check: async () => report("useStore must be used within StoreProvider"),
      write: async () => {
        writes += 1;
      },
      find: () => undefined
    });
    expect(writes).toBe(0);
    expect(outcome.notFound).toEqual(["StoreProvider"]);
  });

  it("stops at once when the stories cannot be drawn", async () => {
    const outcome = await repairRounds({
      componentFile: "/a/Item.tsx",
      storyFile: "/a/Item.stories.tsx",
      check: async () => "no browser",
      write: async () => undefined,
      find: () => undefined
    });
    expect(outcome.report).toBe("no browser");
  });
});
