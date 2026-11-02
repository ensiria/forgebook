/**
 * Tests for paths in Vite's form: Windows paths (`path.win32`, run on any system) written with forward slashes as
 * Vite's ids are, POSIX paths left as they are, and the same text Vite's own `normalizePath` writes.
 *
 * @module
 */
import { posix, win32 } from "node:path";

import { normalizePath } from "vite";
import { describe, expect, it } from "vitest";

import { VITE_PATHS, vitePathsOf } from "../src/vite/vitePaths.ts";

/** Windows' path functions, answering in Vite's form. */
const WINDOWS = vitePathsOf(win32);

/** POSIX's path functions, answering in Vite's form. */
const POSIX = vitePathsOf(posix);

describe("vitePathsOf on Windows", () => {
  it("writes a Windows path with forward slashes, normalised, as Vite's ids are", () => {
    expect(WINDOWS.normalize("C:\\Users\\ada\\app\\.forgebook-shell.ts")).toBe(
      "C:/Users/ada/app/.forgebook-shell.ts"
    );
    expect(WINDOWS.normalize("C:\\Users\\ada\\app\\..\\kit\\.\\src")).toBe("C:/Users/ada/kit/src");
    expect(WINDOWS.normalize("C:/Users/ada/app")).toBe("C:/Users/ada/app");
    expect(WINDOWS.normalize("src\\a\\A.stories.tsx")).toBe("src/a/A.stories.tsx");
    expect(WINDOWS.normalize("")).toBe("");
    // a network path keeps both slashes: with one, Windows reads it as a folder of the current drive
    expect(WINDOWS.normalize("\\\\server\\share\\app\\x.ts")).toBe("//server/share/app/x.ts");
  });

  it("joins, resolves and takes folders in Vite's form, from paths with either separator", () => {
    expect(WINDOWS.join("C:/Users/ada/app", ".forgebook-frame.ts")).toBe(
      "C:/Users/ada/app/.forgebook-frame.ts"
    );
    expect(WINDOWS.join("C:\\Users\\ada\\app", "src\\x.md")).toBe("C:/Users/ada/app/src/x.md");
    expect(WINDOWS.resolve("C:\\Users\\ada\\app", "../kit/src/A.stories.tsx")).toBe(
      "C:/Users/ada/kit/src/A.stories.tsx"
    );
    expect(WINDOWS.dirname("C:/Users/ada/kit/stories.ts")).toBe("C:/Users/ada/kit");
    expect(WINDOWS.dirname("C:\\Users\\ada\\kit\\stories.ts")).toBe("C:/Users/ada/kit");
  });

  it("gives relative paths with forward slashes, empty for the same folder", () => {
    expect(WINDOWS.relative("C:\\Users\\ada\\app", "C:\\Users\\ada\\kit\\src\\A.stories.tsx")).toBe(
      "../kit/src/A.stories.tsx"
    );
    expect(WINDOWS.relative("C:/Users/ada/app", "C:\\Users\\ada\\app")).toBe("");
  });

  it("knows a Windows path for absolute with either separator, and the same file whatever the separators", () => {
    expect(WINDOWS.isAbsolute("C:\\app")).toBe(true);
    expect(WINDOWS.isAbsolute("C:/app")).toBe(true);
    expect(WINDOWS.isAbsolute("@acme/ui/preview")).toBe(false);
    expect(WINDOWS.isSame("C:/Users/ada/app/frame.html", "C:\\Users\\ada\\app\\frame.html")).toBe(true);
    expect(WINDOWS.isSame("C:/Users/ada/app/frame.html", "C:/Users/ada/app/index.html")).toBe(false);
  });
});

describe("relativeKey", () => {
  it("keys a file Windows' glob gives with backslashes with forward slashes, from `./` or `../`", () => {
    expect(WINDOWS.relativeKey("C:/Users/ada/kit", "src\\a\\A.stories.tsx")).toBe("./src/a/A.stories.tsx");
    expect(WINDOWS.relativeKey("C:/Users/ada/kit/forgebook", "..\\src\\A.stories.tsx")).toBe(
      "../src/A.stories.tsx"
    );
  });

  it("gives the same keys on POSIX", () => {
    expect(POSIX.relativeKey("/srv/kit", "src/a/A.stories.tsx")).toBe("./src/a/A.stories.tsx");
    expect(POSIX.relativeKey("/srv/kit/forgebook", "../src/A.stories.tsx")).toBe("../src/A.stories.tsx");
  });
});

describe("vitePathsOf on POSIX", () => {
  it("leaves a backslash alone, a legal character of a file name there", () => {
    expect(POSIX.normalize("/srv/app/a\\b.ts")).toBe("/srv/app/a\\b.ts");
    expect(POSIX.isSame("/srv/app/a\\b.ts", "/srv/app/a/b.ts")).toBe(false);
  });

  it("joins, resolves and relates as Node does", () => {
    expect(POSIX.join("/srv/app", "./src/../x.ts")).toBe("/srv/app/x.ts");
    expect(POSIX.resolve("/srv/app", "../kit")).toBe("/srv/kit");
    expect(POSIX.relative("/srv/app", "/srv/kit/src/A.stories.tsx")).toBe("../kit/src/A.stories.tsx");
  });
});

describe("VITE_PATHS", () => {
  it("writes the same text as Vite's normalizePath on the running system", () => {
    const samples = [
      "/srv/app/.forgebook-shell.ts",
      "/srv/app/../kit/./src/A.stories.tsx",
      "src/a/A.stories.tsx",
      "C:\\Users\\ada\\app\\frame.html",
      "C:/Users/ada/app/frame.html"
    ];
    for (const sample of samples) expect(VITE_PATHS.normalize(sample)).toBe(normalizePath(sample));
  });
});
