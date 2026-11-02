/**
 * Which files a pattern finds: a catalogue at a monorepo's root must not walk its dependencies.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { storyFileKeys } from "../src/vite/storyFilesModule.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-story-keys-"));

for (const file of [
  "src/a.stories.tsx",
  "node_modules/lib/b.stories.tsx",
  "packages/ui/node_modules/lib/c.stories.tsx"
]) {
  mkdirSync(dirname(join(ROOT, file)), { recursive: true });
  writeFileSync(join(ROOT, file), "");
}

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("storyFileKeys", () => {
  it("leaves the dependencies out of a pattern that does not name them", () => {
    expect(storyFileKeys(ROOT, ["**/*.stories.tsx"])).toEqual(["./src/a.stories.tsx"]);
  });

  it("reads them when the pattern names them", () => {
    expect(storyFileKeys(ROOT, ["node_modules/lib/*.stories.tsx"])).toEqual([
      "./node_modules/lib/b.stories.tsx"
    ]);
  });
});
