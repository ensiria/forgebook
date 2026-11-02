/**
 * Tests for `forgebook init --from storybook`'s reading and writing: Storybook's story globs from the `.storybook`
 * folder, the switches from the preview's plain `globalTypes`, a framework Forgebook does not read refused, and the
 * configuration file written from it all.
 *
 * @module
 */
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  expandedGlobs,
  importStorybook,
  previewSwitches,
  storyGlobs
} from "../bin/forgebook/importers/storybook.ts";
import { initConfigText } from "../bin/forgebook/initConfig.ts";
import { STORYBOOK_DIR } from "./fixturePaths.ts";

const scratch = mkdtempSync(join(tmpdir(), "forgebook-import-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("expandedGlobs", () => {
  it("writes out extglob and brace alternatives, nested ones too", () => {
    expect(expandedGlobs("src/**/*.stories.@(ts|tsx)")).toEqual([
      "src/**/*.stories.ts",
      "src/**/*.stories.tsx"
    ]);
    expect(expandedGlobs("src/{a,b}/*.@(mdx|stories.@(js|tsx))")).toEqual([
      "src/a/*.mdx",
      "src/a/*.stories.js",
      "src/a/*.stories.tsx",
      "src/b/*.mdx",
      "src/b/*.stories.js",
      "src/b/*.stories.tsx"
    ]);
    expect(expandedGlobs("src/**/*.stories.tsx")).toEqual(["src/**/*.stories.tsx"]);
  });
});

describe("storyGlobs", () => {
  it("reads globs and folders from the .storybook folder, leaving MDX out and naming a title prefix", () => {
    const { globs, notes } = storyGlobs(
      ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)", { directory: "../lib", titlePrefix: "Lib" }],
      "/project/.storybook",
      "/project"
    );
    expect(globs).toEqual([
      "src/**/*.stories.ts",
      "src/**/*.stories.tsx",
      "lib/**/*.stories.js",
      "lib/**/*.stories.jsx",
      "lib/**/*.stories.mjs",
      "lib/**/*.stories.ts",
      "lib/**/*.stories.tsx"
    ]);
    expect(notes).toEqual([
      '../lib: its titlePrefix "Lib" is not read',
      "The MDX pages are left out: Forgebook reads story files, not MDX"
    ]);
  });
});

describe("storyGlobs, every extension", () => {
  it("writes `.stories.*` out as the extensions Forgebook reads", () => {
    expect(storyGlobs(["../src/**/*.stories.*"], "/project/.storybook", "/project").globs).toEqual([
      "src/**/*.stories.js",
      "src/**/*.stories.jsx",
      "src/**/*.stories.mjs",
      "src/**/*.stories.ts",
      "src/**/*.stories.tsx"
    ]);
  });
});

describe("previewSwitches", () => {
  it("makes a switch of each plain globalType with a toolbar, starting at its initial global", () => {
    const text = [
      "const preview = {",
      '  globalTypes: { size: { toolbar: { title: "Size", items: ["s", "l"] } } },',
      '  initialGlobals: { size: "l" }',
      "};",
      "export default preview;"
    ].join("\n");
    const { switches, notes } = previewSwitches(text, "preview.ts");
    expect(switches).toEqual([
      {
        id: "size",
        label: "Size",
        values: [
          { value: "s", label: "s" },
          { value: "l", label: "l" }
        ],
        default: "l",
        apply: { kind: "code" }
      }
    ]);
    expect(notes).toEqual([]);
  });

  it("names globalTypes it cannot read without running the file, and reads named exports", () => {
    const computed = previewSwitches("export default { globalTypes: makeGlobals() };", "preview.ts");
    expect(computed.switches).toBeUndefined();
    expect(computed.notes[0]).toContain("not plain values");
    const named = previewSwitches(
      'export const globalTypes = { tone: { toolbar: { items: ["warm"] } } };',
      "preview.js"
    );
    expect(named.switches?.map((each) => each.id)).toEqual(["tone"]);
    expect(previewSwitches("export default {};", "preview.ts")).toEqual({ switches: undefined, notes: [] });
    const quoted = previewSwitches(
      'export default { "globalTypes": { tone: { toolbar: { items: ["warm"] } } } };',
      "p.ts"
    );
    expect(quoted.switches?.map((each) => each.id)).toEqual(["tone"]);
  });
});

describe("importStorybook", () => {
  it("reads the Storybook fixture: its stories, its preview and its own toolbar global", async () => {
    const imported = await importStorybook(STORYBOOK_DIR);
    if (typeof imported === "string") throw new Error(imported);
    expect(imported.title).toBe("@fixture/storybook");
    expect(imported.stories).toEqual([
      "src/**/*.stories.js",
      "src/**/*.stories.jsx",
      "src/**/*.stories.ts",
      "src/**/*.stories.tsx"
    ]);
    expect(imported.preview).toBe(".storybook/preview.tsx");
    // the backgrounds addon's global is left out: the catalogue has its own background
    expect(imported.switches?.map((each) => [each.id, each.default])).toEqual([["density", "compact"]]);
    expect(imported.notes).toContain(
      "The addons are left out: Forgebook has its own panel, toolbar and checks"
    );
  });

  it("reads a Vue project's Storybook as Vue", async () => {
    const project = join(scratch, "vue");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(project, ".storybook"), { recursive: true });
    writeFileSync(
      join(project, ".storybook", "main.ts"),
      'export default { stories: ["../src/**/*.stories.ts"], framework: "@storybook/vue3-vite" };\n'
    );
    const imported = await importStorybook(project);
    expect(typeof imported === "string" ? imported : imported.framework).toBe("vue");
  });

  it("reads a Svelte project's Storybook as Svelte, SvelteKit's too, naming its Svelte CSF files", async () => {
    for (const framework of ["@storybook/svelte-vite", "@storybook/sveltekit"]) {
      const project = join(scratch, framework.replace(/\W/g, "-"));
      cpSync(join(STORYBOOK_DIR, ".storybook"), join(project, ".storybook"), { recursive: true });
      writeFileSync(
        join(project, ".storybook", "main.ts"),
        `export default { stories: ["../src/**/*.stories.@(ts|svelte)"], framework: ${JSON.stringify(framework)} };\n`
      );
      const imported = await importStorybook(project);
      if (typeof imported === "string") throw new Error(imported);
      expect(imported.framework).toBe("svelte");
      expect(imported.stories).toEqual(["src/**/*.stories.ts"]);
      expect(imported.notes).toContain("src/**/*.stories.svelte: not a story file Forgebook reads");
      expect(imported.notes.some((note) => note.startsWith("SvelteKit's $app modules"))).toBe(
        framework === "@storybook/sveltekit"
      );
    }
  });

  it("refuses a framework Forgebook does not read, saying what it reads", async () => {
    const project = join(scratch, "angular");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(project, ".storybook"), { recursive: true });
    writeFileSync(
      join(project, ".storybook", "main.ts"),
      'export default { stories: ["../src/**/*.stories.ts"], framework: "@storybook/angular" };\n'
    );
    expect(await importStorybook(project)).toBe(
      "Forgebook reads Storybook's stories on Vite (@storybook/react-vite, @storybook/vue3-vite, @storybook/svelte-vite, @storybook/sveltekit); this project uses @storybook/angular"
    );
    expect(await importStorybook(join(scratch, "none"))).toContain("No .storybook/main file");
    // Storybook's monorepo template writes the framework as a path to its package
    const monorepo = join(scratch, "monorepo");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(monorepo, ".storybook"), { recursive: true });
    writeFileSync(
      join(monorepo, ".storybook", "main.ts"),
      'export default { stories: ["../src/**/*.stories.tsx"], framework: { name: "/repo/node_modules/@storybook/react-vite" } };\n'
    );
    const imported = await importStorybook(monorepo);
    expect(typeof imported === "string" ? imported : imported.stories).toEqual(["src/**/*.stories.tsx"]);
  });
});

describe("initConfigText", () => {
  it("writes the configuration as a person would, with the switches read from the preview", () => {
    const text = initConfigText(
      {
        framework: "react",
        title: "acme-ui",
        stories: ["src/**/*.stories.tsx"],
        preview: ".storybook/preview.tsx",
        switches: [
          {
            id: "density",
            label: "Density",
            values: [{ value: "compact", label: "Compact" }],
            default: "compact",
            apply: { kind: "code" }
          }
        ],
        notes: []
      },
      "Storybook"
    );
    expect(text).toContain('import { defineConfig } from "forgebook";');
    expect(text).toContain('  title: "acme-ui",');
    expect(text).toContain('  preview: ".storybook/preview.tsx",');
    expect(text).toContain('      id: "density",');
    expect(text).toMatch(/\n {2}\]\n\}\);\n$/);
    const plain = initConfigText(
      {
        framework: "react",
        title: "x",
        stories: ["src/*.stories.tsx"],
        preview: undefined,
        switches: undefined,
        notes: []
      },
      "Storybook"
    );
    expect(plain).toContain('  stories: [\n    "src/*.stories.tsx"\n  ]\n});');
    expect(plain).not.toContain("switches");
  });

  it("names the framework the stories are written for", () => {
    const text = initConfigText(
      {
        framework: "vue",
        title: "x",
        stories: ["src/*.stories.ts"],
        preview: undefined,
        switches: undefined,
        notes: []
      },
      "Storybook"
    );
    expect(text).toContain('import { vue } from "@forgebook/vue/vite";');
    expect(text).toContain("  framework: vue(),");
  });
});
