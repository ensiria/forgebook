/**
 * Tests for what marks a real library's install as done: a changed definition installs again.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { installStamp } from "./prepareCorpus.ts";
import type { RealCorpus } from "./realCorpus.types.ts";

const CORPUS: RealCorpus = {
  name: "lib",
  repository: "https://example.com/lib.git",
  commit: "a".repeat(40),
  licence: "MIT",
  install: ["npm", "ci"],
  folder: ".",
  expected: { files: 1, stories: 1 },
  measured: { forgebookStory: "s", forgebookComponent: "c", text: "t", pageText: "p", sidebar: "g" },
  edits: {
    story: { file: "a.stories.tsx", find: "x", replace: "{edit}" },
    component: { file: "a.tsx", find: "y", replace: "{edit}" }
  }
};

describe("installStamp", () => {
  it("changes with the commit, the install and the preparation", () => {
    const stamp = installStamp(CORPUS);
    expect(installStamp({ ...CORPUS, commit: "b".repeat(40) })).not.toBe(stamp);
    expect(installStamp({ ...CORPUS, install: ["npm", "install"] })).not.toBe(stamp);
    expect(installStamp({ ...CORPUS, prepare: [["npm", "run", "build"]] })).not.toBe(stamp);
    expect(installStamp({ ...CORPUS })).toBe(stamp);
  });
});
