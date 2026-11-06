/**
 * Tests for which changed files a person sees and which stories show them.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  belongsToOtherCatalogue,
  changedUiFiles,
  deletedForms,
  type IdentifiedStory,
  isUiFile,
  type UiFilesInput
} from "../src/vite/changeCoverage.ts";
import type { ReachedStory } from "../src/vite/storyReach.ts";

const NO_TEXT = (): string => "";

describe("isUiFile", () => {
  it.each([
    "src/Badge.tsx",
    "src/Badge.jsx",
    "src/Badge.vue",
    "src/Badge.svelte",
    "src/Badge.astro",
    "src/badge.css",
    "src/badge.module.scss",
    "src/Badge.stories.ts",
    "src/badge.component.ts",
    "src/badge.component.html",
    "src/build/BuildCard.tsx",
    "src/vendor/VendorCard.tsx",
    "src/features/test/TestCard.tsx",
    "src/Button.css.ts",
    "src/Button.styles.ts",
    "src/a.pcss",
    "src/a.styl"
  ])("counts %s", (file) => {
    expect(isUiFile(file, NO_TEXT)).toBe(true);
  });

  it.each([
    "README.md",
    "package.json",
    "src/format.ts",
    "src/useToggle.ts",
    "src/Badge.test.tsx",
    "src/Badge.spec.tsx",
    "e2e/Badge.tsx",
    "dist/Badge.js",
    "src/types.d.ts",
    "src/generated/Icons.tsx",
    "tokens.json",
    "src/__snapshots__/Button.stories.tsx.snap",
    "src/Button.stories.test.tsx",
    "src/Button.cy.tsx",
    "src/test-utils.tsx",
    "src/__mocks__/Icon.tsx",
    "cypress/support/mount.tsx"
  ])("leaves out %s", (file) => {
    expect(isUiFile(file, NO_TEXT)).toBe(false);
  });

  it("counts a script only when its text defines a component", () => {
    expect(isUiFile("src/x-badge.ts", () => "customElements.define('x-badge', Badge);")).toBe(true);
    expect(isUiFile("src/x-badge.ts", () => "class Badge extends LitElement {}")).toBe(true);
    expect(isUiFile("src/Button.js", () => "export const B = () => <Icon size={1} />;")).toBe(true);
    expect(isUiFile("src/x.ts", () => "export const add = (a, b) => a + b;")).toBe(false);
    expect(isUiFile("src/x.ts", () => "export const isSmall = a < B && c > d;")).toBe(false);
    expect(isUiFile("src/x.ts", () => "const page = `/frame.html`;")).toBe(false);
    expect(isUiFile("src/x.ts", () => "const view = html`<p></p>`;")).toBe(true);
    // TSDoc mentions a tag: TypeScript holds no JSX outside `.tsx`
    expect(isUiFile("src/x.ts", () => "/** Lines are `<mark>` and `</mark>`. */")).toBe(false);
  });
});

const story = (id: string, files: readonly string[], own: readonly string[]): IdentifiedStory => {
  const reach: ReachedStory = {
    title: "T",
    exportName: "Plain",
    storyFile: "/r/src/T.stories.tsx",
    files,
    own
  };
  return { id, reach };
};

const entry = (file: string, isDeleted = false): UiFilesInput["files"][number] => ({
  file,
  path: file,
  absolute: `/r/${file}`,
  isDeleted
});

const input: Omit<UiFilesInput, "files"> = {
  stories: [
    story("own", ["/r/src/Button.tsx", "/r/src/Icon.tsx"], ["/r/src/Button.tsx"]),
    story("other", ["/r/src/Card.tsx"], ["/r/src/Card.tsx"])
  ],
  everyStoryFiles: new Set<string>(),
  isOtherCatalogues: () => false,
  readText: NO_TEXT
};

describe("changedUiFiles", () => {
  it("tells a file with its own stories from one reached through another's, and from one with none", () => {
    const { uiFiles, outside } = changedUiFiles({
      ...input,
      files: [entry("src/Button.tsx"), entry("src/Icon.tsx"), entry("src/Badge.tsx"), entry("src/format.ts")]
    });
    expect(uiFiles).toEqual([
      { file: "src/Button.tsx", path: "src/Button.tsx", coverage: "own", stories: ["own"] },
      { file: "src/Icon.tsx", path: "src/Icon.tsx", coverage: "through", stories: ["own"] },
      { file: "src/Badge.tsx", path: "src/Badge.tsx", coverage: "none", stories: [] }
    ]);
    expect(outside).toEqual([]);
  });

  it("gives every story to what every story shows", () => {
    const { uiFiles } = changedUiFiles({
      ...input,
      everyStoryFiles: new Set(["/r/src/global.css"]),
      files: [entry("src/global.css")]
    });
    expect(uiFiles[0]).toMatchObject({ coverage: "through", stories: ["own", "other"] });
  });

  it("names a file of another catalogue, unless a story of this one reaches it", () => {
    const { uiFiles, outside } = changedUiFiles({
      ...input,
      isOtherCatalogues: (file: string): boolean => file.startsWith("/r/apps/"),
      stories: [story("own", ["/r/lib/Shared.tsx"], [])],
      files: [entry("apps/Page.tsx"), entry("lib/Shared.tsx")]
    });
    expect(outside).toEqual(["apps/Page.tsx"]);
    expect(uiFiles.map((each) => each.file)).toEqual(["lib/Shared.tsx"]);
  });

  it("leaves out a deleted file nothing reaches, and keeps one a story still imports", () => {
    const { uiFiles } = changedUiFiles({
      ...input,
      stories: [story("own", ["/r/src/Gone"], [])],
      files: [entry("src/Unused.tsx", true), entry("src/Gone.tsx", true)]
    });
    expect(uiFiles).toEqual([
      { file: "src/Gone.tsx", path: "src/Gone.tsx", coverage: "through", stories: ["own"] }
    ]);
  });
});

describe("deletedForms", () => {
  it("names the forms an import can have left", () => {
    expect(deletedForms("/r/src/Icon.tsx")).toEqual(["/r/src/Icon.tsx", "/r/src/Icon"]);
    expect(deletedForms("/r/src/icons/index.ts")).toEqual([
      "/r/src/icons/index.ts",
      "/r/src/icons/index",
      "/r/src/icons"
    ]);
  });
});

describe("belongsToOtherCatalogue", () => {
  const has = (folder: string): boolean => folder === "/r/apps/other";
  it("gives a file to the nearest catalogue, and to this one when it is nearest or there is none", () => {
    expect(belongsToOtherCatalogue("/r/apps/other/src/A.tsx", "/r/apps/cat", "/r", has)).toBe(true);
    expect(belongsToOtherCatalogue("/r/apps/cat/src/A.tsx", "/r/apps/cat", "/r", has)).toBe(false);
    // a package with none is this catalogue's to fail, or its components would pass unseen
    expect(belongsToOtherCatalogue("/r/packages/ui/A.tsx", "/r/apps/cat", "/r", has)).toBe(false);
    expect(belongsToOtherCatalogue("/r/A.tsx", "/r/apps/cat", "/r", has)).toBe(false);
  });
});
