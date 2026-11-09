/**
 * What a catalogue takes of a Nuxt project's modules from what Nuxt wrote: their auto-imports and components, the
 * files and scripts of its build folder, and the packages those import.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { normalizePath } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import {
  builtFile,
  builtScriptName,
  isBuiltHere,
  isWrittenByNuxt,
  loadNuxtModules,
  moduleComponents,
  moduleImports,
  type NuxtModules
} from "../src/vite/nuxtModules.ts";

const made: string[] = [];

/** A folder holding these files, removed after the test. */
const folderWith = (files: Readonly<Record<string, string>>): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "forgebook-nuxt-modules-")));
  made.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The project the paths are under, absolute on the running system (`D:/p` on Windows), in Vite's form. */
const PROJECT = normalizePath(resolve("/p"));

const BUILD = `${PROJECT}/.nuxt`;

describe("a module's auto-imports", () => {
  const Text = [
    "export { ref, computed } from 'vue';",
    "export { useState } from '../node_modules/nuxt/dist/app/composables/state';",
    "export { useToast, defineShortcuts as shortcuts } from '../node_modules/@nuxt/ui/dist/runtime/composables/useToast';",
    "export { useNuxtApp } from '#app/nuxt';",
    "export { useThing } from 'vue-demi';"
  ].join("\n");

  it("are the modules', not Nuxt's, Vue's or a virtual module's", () => {
    expect(moduleImports(Text, BUILD)).toEqual([
      {
        name: "useToast",
        as: "useToast",
        from: `${PROJECT}/node_modules/@nuxt/ui/dist/runtime/composables/useToast`
      },
      {
        name: "defineShortcuts",
        as: "shortcuts",
        from: `${PROJECT}/node_modules/@nuxt/ui/dist/runtime/composables/useToast`
      },
      { name: "useThing", as: "useThing", from: "vue-demi" }
    ]);
  });

  it("leave out a source that cannot load, since one would stop every story", () => {
    expect(moduleImports(Text, BUILD, (from) => from !== "vue-demi").map(({ as }) => as)).toEqual([
      "useToast",
      "shortcuts"
    ]);
  });

  it("are refused when a name or a path is more than a name or a path", () => {
    const text = [
      "export { * as x from '/a.js'; globalThis.pwned = 1; export * as y } from \"/a.js\"",
      "export { good } from '/a.js\"; evil()'"
    ].join("\n");
    const read = moduleImports(text, BUILD);
    expect(read.map(({ as }) => as)).toEqual(["good"]);
    expect(read[0]?.from).toBe("/a.js");
  });

  it("are read in a strict install's folders too", () => {
    const text = "export { useX } from '../node_modules/.pnpm/nuxt@4/node_modules/nuxt/dist/app/x';";
    expect(moduleImports(text, BUILD)).toEqual([]);
  });
});

describe("a module's components", () => {
  it("are the modules', with their files", () => {
    const text = [
      `export const UButton: typeof import("../node_modules/@nuxt/ui/dist/runtime/components/Button.vue")['default']`,
      `export const LazyUButton: LazyComponent<typeof import("../node_modules/@nuxt/ui/dist/runtime/components/Button.vue")['default']>`,
      `export const UCard: typeof import("../node_modules/@nuxt/ui/dist/runtime/components/Card.vue").default`,
      `export const NuxtLink: typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']`
    ].join("\n");
    expect(moduleComponents(text, BUILD)).toEqual([
      { name: "UButton", file: `${PROJECT}/node_modules/@nuxt/ui/dist/runtime/components/Button.vue` },
      { name: "UCard", file: `${PROJECT}/node_modules/@nuxt/ui/dist/runtime/components/Card.vue` }
    ]);
  });

  it("keep the export a component is registered by, when it is not the default", () => {
    const text = [
      `export const Button: typeof import("../app/components/ui/button/index")['Button']`,
      `export const LazyButton: LazyComponent<typeof import("../app/components/ui/button/index")['Button']>`,
      `export const Input: typeof import("../app/components/ui/input/index").Input`
    ].join("\n");
    expect(moduleComponents(text, BUILD)).toEqual([
      { name: "Button", file: `${PROJECT}/app/components/ui/button/index`, exportName: "Button" },
      { name: "Input", file: `${PROJECT}/app/components/ui/input/index`, exportName: "Input" }
    ]);
  });
});

describe("the build folder", () => {
  it("is this project's only when its app config imports the project's own", () => {
    const own = `${PROJECT}/app/app.config.ts`;
    expect(isBuiltHere(`import cfg0 from "${own}"`, own)).toBe(true);
    expect(isBuiltHere(`import cfg0 from "/elsewhere/app/app.config.ts"`, own)).toBe(false);
    expect(isBuiltHere("", own)).toBe(true);
    expect(isBuiltHere(`import cfg0 from "/elsewhere/app/app.config.ts"`, undefined)).toBe(true);
  });

  it("gives a file Nuxt wrote, its extension left out or not", () => {
    const dir = folderWith({ "app.config.mjs": "", "ui.css": "" });
    expect(builtFile("#build/app.config", dir)).toBe(normalizePath(join(dir, "app.config.mjs")));
    expect(builtFile("#build/ui.css", dir)).toBe(normalizePath(join(dir, "ui.css")));
    expect(builtFile("#build/gone.css", dir)).toBeUndefined();
    expect(builtFile("#app", dir)).toBeUndefined();
    expect(builtFile("#build/ui.css", undefined)).toBeUndefined();
    expect(builtFile("#build/../../etc/passwd", dir)).toBeUndefined();
  });

  it("names a script Nuxt keeps in memory", () => {
    const scripts = new Map([["i18n-options.mjs", "export {}"]]);
    expect(builtScriptName("#build/i18n-options.mjs", scripts)).toBe("i18n-options.mjs");
    expect(builtScriptName("#build/i18n-options", scripts)).toBe("i18n-options.mjs");
    expect(builtScriptName("#build/other", scripts)).toBeUndefined();
  });

  it("tells a file Nuxt wrote from the project's", () => {
    const modules: NuxtModules = {
      plugins: [],
      leftOut: [],
      css: [],
      buildDir: "/p/.nuxt",
      isFresh: true,
      nuxtDir: "/p/node_modules/nuxt",
      builtScripts: new Map(),
      imports: [],
      components: [],
      problems: []
    };
    expect(isWrittenByNuxt("/p/.nuxt/app.config.mjs", modules)).toBe(true);
    expect(isWrittenByNuxt("\0forgebook-nuxt:kept:i18n-options.mjs", modules)).toBe(true);
    expect(isWrittenByNuxt("/p/app/app.vue", modules)).toBe(false);
    expect(isWrittenByNuxt(undefined, modules)).toBe(false);
  });
});

describe("a project without Nuxt", () => {
  it("gives nothing, and says nothing", async () => {
    expect(await loadNuxtModules(folderWith({ "package.json": "{}" }))).toMatchObject({
      plugins: [],
      css: undefined,
      problems: []
    });
  });
});
