/**
 * Tests for the changed files named as the catalogue's graph names them: under the catalogue's folder as configured,
 * in Vite's form, from the real paths git gives.
 *
 * @module
 */
import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import { catalogueChangedFiles } from "../src/vite/gitChange.ts";
import { vitePathsOf } from "../src/vite/vitePaths.ts";

describe("catalogueChangedFiles", () => {
  it("names a change under a Windows folder with forward slashes, as the graph's files are", () => {
    expect(
      catalogueChangedFiles(
        "C:/Users/ada/app",
        "C:\\Users\\ada\\app",
        "C:/Users/ada",
        ["app/src/Button.tsx", "kit/src/Select.tsx"],
        vitePathsOf(win32)
      )
    ).toEqual(["C:/Users/ada/app/src/Button.tsx", "C:/Users/ada/kit/src/Select.tsx"]);
  });

  it("names a change under the configured folder when the real one is reached through a link", () => {
    expect(
      catalogueChangedFiles(
        "/home/ada/app",
        "/srv/work/app",
        "/srv/work",
        ["app/src/Button.tsx"],
        vitePathsOf(posix)
      )
    ).toEqual(["/home/ada/app/src/Button.tsx"]);
  });
});
