/**
 * Tests for what a package's build for npm writes and publishes.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { distPath, isCompiled, isPublished, publishConfigOf, withCompiledStyles } from "./packageBuild.ts";

describe("distPath", () => {
  it("lands TypeScript as JavaScript, a style sheet compiled, any other file as it is", () => {
    expect(distPath("./src/shell/mountShell.tsx")).toBe("./dist/src/shell/mountShell.js");
    expect(distPath("src/vite/config.ts")).toBe("./dist/src/vite/config.js");
    expect(distPath("./bin/forgebook/forgebook.mts")).toBe("./dist/bin/forgebook/forgebook.mjs");
    expect(distPath("./src/shell/shell.scss")).toBe("./dist/src/shell/shell.css");
    expect(distPath("./src/client.d.ts")).toBe("./dist/src/client.d.ts");
    expect(distPath("./src/fonts/fonts.css")).toBe("./dist/src/fonts/fonts.css");
  });
});

describe("publishConfigOf", () => {
  it("publishes each export's declarations and JavaScript, a declaration as types, a file as its path", () => {
    const published = publishConfigOf(
      {
        ".": "./src/vite/config.ts",
        "./client": "./src/client.d.ts",
        "./fonts.css": "./src/fonts/fonts.css"
      },
      { forgebook: "./bin/forgebook/forgebook.mts" }
    );
    expect(published).toEqual({
      access: "public",
      exports: {
        ".": { types: "./dist/src/vite/config.d.ts", default: "./dist/src/vite/config.js" },
        "./client": { types: "./dist/src/client.d.ts" },
        "./fonts.css": "./dist/src/fonts/fonts.css"
      },
      bin: { forgebook: "./dist/bin/forgebook/forgebook.mjs" }
    });
  });

  it("leaves out bin for a package without commands", () => {
    expect(publishConfigOf({ ".": "./src/a.ts" }, undefined)).not.toHaveProperty("bin");
  });
});

describe("withCompiledStyles", () => {
  it("points the imports of style sheets at the compiled ones, and nothing else", () => {
    const code = 'import "./shell.scss";\nimport { a } from "../a.js";\nconst text = "kept.scss";';
    expect(withCompiledStyles(code)).toBe(
      'import "./shell.css";\nimport { a } from "../a.js";\nconst text = "kept.scss";'
    );
  });
});

describe("which sources the build takes", () => {
  it("compiles TypeScript and Sass, copies the rest, and leaves out tests, tsconfigs and Sass partials", () => {
    expect(isCompiled("src/a.tsx")).toBe(true);
    expect(isCompiled("src/shell/shell.scss")).toBe(true);
    expect(isCompiled("src/client.d.ts")).toBe(false);
    expect(isPublished("src/a.test.ts")).toBe(false);
    expect(isPublished("src/test/fixture.ts")).toBe(false);
    expect(isPublished("src/vite/tsconfig.json")).toBe(false);
    expect(isPublished("src/styles/_tokens.scss")).toBe(false);
    expect(isPublished("src/fonts/Inter-latin.woff2")).toBe(true);
  });
});
