/**
 * Tests for what the plugin reads of a Nuxt project's files: its pages' routes, its components' names, its config.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { BUILT_IN_COMPONENTS } from "../src/app/components.ts";
import { componentName, wordsOf } from "../src/vite/componentNames.ts";
import { readNuxtConfig, resolvedPath, withEnvironment } from "../src/vite/nuxtConfig.ts";
import { pageRoutes } from "../src/vite/pageRoutes.ts";
import { BUILT_IN_COMPONENT_NAMES } from "../src/vite/standIns.ts";

/** A scratch folder for the tests that read files. */
const scratch = mkdtempSync(join(tmpdir(), "forgebook-nuxt-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("the pages' routes", () => {
  it("names and writes each route as Nuxt does", () => {
    expect(
      pageRoutes([
        "index.vue",
        "about.vue",
        "blog/index.vue",
        "blog/[slug].vue",
        "docs/[...path].vue",
        "shop/[[category]].vue",
        "users/user-[id].vue",
        "(admin)/settings.vue",
        "-draft.vue",
        "notes.md"
      ])
    ).toEqual([
      { path: "/", name: "index" },
      { path: "/about", name: "about" },
      { path: "/blog", name: "blog" },
      { path: "/blog/:slug()", name: "blog-slug" },
      { path: "/docs/:path(.*)*", name: "docs-path" },
      { path: "/shop/:category?", name: "shop-category" },
      { path: "/users/user-:id()", name: "users-user-id" },
      { path: "/settings", name: "settings" }
    ]);
  });

  it("leaves out a page that has children, which carry their full paths", () => {
    expect(pageRoutes(["parent.vue", "parent/child.vue", "parent/deep/leaf.vue"])).toEqual([
      { path: "/parent/child", name: "parent-child" },
      { path: "/parent/deep/leaf", name: "parent-deep-leaf" }
    ]);
  });
});

describe("the components' names", () => {
  it("puts the folders first and does not repeat what the file's name says", () => {
    expect(componentName("base/Button.vue", "", true)).toBe("BaseButton");
    expect(componentName("base/BaseButton.vue", "", true)).toBe("BaseButton");
    expect(componentName("base/foo/FooButton.vue", "", true)).toBe("BaseFooButton");
    expect(componentName("form/inputs/index.vue", "", true)).toBe("FormInputs");
    expect(componentName("app-header.vue", "", true)).toBe("AppHeader");
    expect(componentName("Chart.client.vue", "", true)).toBe("Chart");
  });

  it("takes the folder's prefix, and its folders only when it says so", () => {
    expect(componentName("Button.vue", "ui", true)).toBe("UiButton");
    expect(componentName("deep/Button.vue", "", false)).toBe("Button");
  });

  it("leaves out stories, tests and declarations", () => {
    expect(componentName("Button.stories.ts", "", true)).toBeUndefined();
    expect(componentName("Button.test.ts", "", true)).toBeUndefined();
    expect(componentName("types.d.ts", "", true)).toBeUndefined();
    expect(componentName("notes.md", "", true)).toBeUndefined();
  });

  it("splits a name into words at a dash and a change of case", () => {
    expect(wordsOf("nuxt-link")).toEqual(["nuxt", "link"]);
    expect(wordsOf("HTMLViewer")).toEqual(["HTML", "Viewer"]);
  });

  it("lists every built-in component the page registers", () => {
    expect([...BUILT_IN_COMPONENT_NAMES].sort()).toEqual(Object.keys(BUILT_IN_COMPONENTS).sort());
  });
});

describe("nuxt.config", () => {
  it("resolves Nuxt's path aliases, a relative path and a package", () => {
    expect(resolvedPath("~/assets/a.css", "/p", "/p/app")).toBe("/p/app/assets/a.css");
    expect(resolvedPath("@@/shared", "/p", "/p/app")).toBe("/p/shared");
    expect(resolvedPath("./x", "/p", "/p/app")).toBe("/p/x");
    expect(resolvedPath("some-package/style.css", "/p", "/p/app")).toBe("some-package/style.css");
  });

  it("reads Nuxt 4's layout, the components' folders, the style sheets and the public config only", () => {
    const root = join(scratch, "four");
    mkdirSync(join(root, "app"), { recursive: true });
    const config = readNuxtConfig(
      {
        css: ["~/main.css", 3],
        components: [{ path: "~/ui", prefix: "Ui" }, "~/other"],
        runtimeConfig: { secret: "x", public: { siteName: "Shop" } },
        imports: { dirs: ["~/stores"] },
        app: { baseURL: "/shop/" }
      },
      undefined,
      root
    );
    expect(config.srcDir).toBe(join(root, "app"));
    expect(config.pagesDir).toBe(join(root, "app", "pages"));
    expect(config.css).toEqual([join(root, "app", "main.css")]);
    expect(config.componentsDirs).toEqual([
      { path: join(root, "app", "ui"), prefix: "Ui", pathPrefix: true },
      { path: join(root, "app", "other"), prefix: "", pathPrefix: true }
    ]);
    expect(config.publicRuntimeConfig).toEqual({ siteName: "Shop" });
    expect(config.importsDirs).toContain(join(root, "app", "stores"));
    expect(config.baseURL).toBe("/shop/");
    expect(readNuxtConfig({ components: false }, undefined, root).componentsDirs).toEqual([]);
    expect(readNuxtConfig({}, undefined, scratch).srcDir).toBe(scratch);
  });

  it("puts the environment's NUXT_PUBLIC_ variables over the keys the config has", () => {
    expect(
      withEnvironment(
        { apiBase: "/api", map: { key: "a" }, count: 1 },
        {
          NUXT_PUBLIC_API_BASE: "/v2",
          NUXT_PUBLIC_MAP_KEY: "b",
          NUXT_PUBLIC_COUNT: "2",
          NUXT_PUBLIC_OTHER: "x"
        }
      )
    ).toEqual({ apiBase: "/v2", map: { key: "b" }, count: 2 });
  });

  it("loads a config that calls defineNuxtConfig without importing it, and says why one cannot load", () => {
    const good = join(scratch, "good");
    mkdirSync(good, { recursive: true });
    writeFileSync(
      join(good, "nuxt.config.mjs"),
      "export default defineNuxtConfig({ app: { baseURL: '/x/' } });\n"
    );
    const bad = join(scratch, "bad");
    mkdirSync(bad, { recursive: true });
    writeFileSync(join(bad, "nuxt.config.mjs"), "throw new Error('broken');\n");
    // as the dev server loads it, on Node: Vitest's own module loader would stand in for Node's import
    const script = [
      `import { loadNuxtConfig } from ${JSON.stringify(join(import.meta.dirname, "..", "src", "vite", "nuxtConfig.ts"))};`,
      `const good = await loadNuxtConfig(${JSON.stringify(good)});`,
      `const bad = await loadNuxtConfig(${JSON.stringify(bad)});`,
      "process.stdout.write(JSON.stringify({ baseURL: good.config.baseURL, problem: good.problem ?? null,",
      "  isLeft: 'defineNuxtConfig' in globalThis, badProblem: bad.problem }));"
    ].join("\n");
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8"
    });
    const read: unknown = JSON.parse(output);
    expect(read).toMatchObject({ baseURL: "/x/", problem: null, isLeft: false });
    expect(JSON.stringify(read)).toContain("broken");
  });
});
