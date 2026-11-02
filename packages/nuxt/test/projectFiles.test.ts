/**
 * Tests for what the plugin reads of a Nuxt project's files: its pages' routes, its components' names, its config.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import MagicString from "magic-string";
import { afterAll, describe, expect, it } from "vitest";

import { BUILT_IN_COMPONENTS } from "../src/app/components.ts";
import { componentName, wordsOf } from "../src/vite/componentNames.ts";
import { readNuxtConfig, resolvedPath, withEnvironment } from "../src/vite/nuxtConfig.ts";
import { componentsOf, isProjectFile, nuxtPlugins, withProcessFlags } from "../src/vite/nuxtPlugin.ts";
import { pageRoutes } from "../src/vite/pageRoutes.ts";
import { BUILT_IN_COMPONENT_NAMES } from "../src/vite/standIns.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

  it("keeps a parent page and its children, the parent left out when an index child takes its path", () => {
    expect(
      pageRoutes(["user.vue", "user/settings.vue", "shop.vue", "shop/index.vue", "shop/cart.vue"])
    ).toEqual([
      { path: "/user", name: "user" },
      { path: "/user/settings", name: "user-settings" },
      { path: "/shop", name: "shop" },
      { path: "/shop/cart", name: "shop-cart" }
    ]);
  });

  it("lets a catch-all in the middle of a path take its own segment only", () => {
    expect(pageRoutes(["files/[...path]/edit.vue"])).toEqual([
      { path: "/files/:path([^/]*)*/edit", name: "files-path-edit" }
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

  it("names an index file by its folder, and leaves an island's suffix out", () => {
    expect(componentName("deep/index.vue", "", false)).toBe("Deep");
    expect(componentName("Chart.island.vue", "", true)).toBe("Chart");
  });

  it("scans the global and islands folders first, a file once, and leaves out a name code cannot hold", () => {
    const root = join(scratch, "components");
    mkdirSync(join(root, "app", "components", "global"), { recursive: true });
    writeFileSync(join(root, "app", "components", "global", "Logo.vue"), "");
    writeFileSync(join(root, "app", "components", "a;alert(1)x.vue"), "");
    const config = readNuxtConfig({}, undefined, root);
    expect(config.componentsDirs.map((dir) => dir.path.slice(root.length))).toEqual([
      "/app/components/islands",
      "/app/components/global",
      "/app/components"
    ]);
    const { components, skipped } = componentsOf(config);
    // read from the global folder, not again as `GlobalLogo` from the components' one
    expect([...components.keys()]).toEqual(["Logo"]);
    expect(skipped).toEqual([join(root, "app", "components", "a;alert(1)x.vue")]);
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

describe("the plugin", () => {
  it("transforms the project's own files, not a folder beside it whose name starts the same", () => {
    expect(isProjectFile("/p/app/components/A.vue", "/p/app")).toBe(true);
    expect(isProjectFile("/p/app-admin/A.vue", "/p/app")).toBe(false);
  });

  it("gives the page Nuxt's names for where code runs, Nuxt 3's in the project's files only", async () => {
    const main: unknown = nuxtPlugins({ dir: join(scratch, "none") })[0];
    const hook = isRecord(main) ? main["config"] : undefined;
    const config: unknown =
      typeof hook === "function"
        ? await Reflect.apply(hook, undefined, [{}, { command: "serve", mode: "development" }])
        : undefined;
    const define = isRecord(config) ? config["define"] : undefined;
    expect(define).toMatchObject({
      "import.meta.client": "true",
      "import.meta.server": "false",
      "import.meta.dev": "true"
    });
    // Nuxt 3's names are written in the project's files only, not given to the libraries the page loads
    expect(Object.keys(isRecord(define) ? define : {}).some((name) => name.startsWith("process."))).toBe(
      false
    );
    const code = new MagicString(
      "if (process.client && !process.server) log(process.dev, my.process.client);"
    );
    expect(withProcessFlags(code, false)).toBe(true);
    expect(code.toString()).toBe("if (true && !false) log(false, my.process.client);");
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
        imports: { dirs: ["~/stores", "helpers", "./more"] },
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
    // as Nuxt reads them, from the sources' folder
    expect(config.importsDirs).toEqual(
      expect.arrayContaining([
        join(root, "app", "stores"),
        join(root, "app", "helpers"),
        join(root, "app", "more")
      ])
    );
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
