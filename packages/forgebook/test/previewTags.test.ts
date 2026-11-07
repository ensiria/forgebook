/**
 * A preview's tags: read from its text, and joined under each story's own.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { tagsOfPreviewText, withPreviewTags } from "../src/vite/previewTags.ts";
import type { IndexedStoryFile } from "../src/vite/storyFilesModule.ts";

describe("tagsOfPreviewText", () => {
  it("reads a preview's plain tags", () => {
    expect(
      tagsOfPreviewText("p.ts", `const preview = { tags: ["stable"] }; export default preview;`)
    ).toEqual(["stable"]);
    expect(tagsOfPreviewText("p.ts", `export default { tags: ["a", "!b"] };`)).toEqual(["a", "!b"]);
  });

  it("has none when it writes none, or none plainly", () => {
    expect(tagsOfPreviewText("p.ts", "export default { decorators: [] };")).toEqual([]);
    expect(tagsOfPreviewText("p.ts", "export const decorators = [];")).toEqual([]);
    expect(tagsOfPreviewText("p.ts", "export default { tags: list() };")).toEqual([]);
  });
});

describe("withPreviewTags", () => {
  const file: IndexedStoryFile = {
    key: "./a.stories.tsx",
    pattern: "*.stories.tsx",
    file: "/a.stories.tsx",
    index: {
      title: "A",
      stories: [{ exportName: "Plain" }, { exportName: "Out", tags: ["!stable", "new"] }]
    }
  };

  it("puts them under a story's own, whose !name takes one away", () => {
    const [joined] = withPreviewTags([file], ["stable"]);
    expect(joined?.index.stories.map((story) => story.tags)).toEqual([["stable"], ["!stable", "new"]]);
  });

  it("puts them under the meta's too, so a preview's status is every component's", () => {
    const [joined] = withPreviewTags(
      [{ ...file, index: { ...file.index, tags: ["!stable", "kit"] } }],
      ["stable"]
    );
    expect(joined?.index.tags).toEqual(["!stable", "kit"]);
    expect(withPreviewTags([file], ["review"])[0]?.index.tags).toEqual(["review"]);
  });

  it("leaves the files as they are with none", () => {
    expect(withPreviewTags([file], [])[0]).toBe(file);
  });
});
