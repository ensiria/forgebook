/**
 * The app's own build as a catalogue reads it: what counts as `tsconfig` paths, which plugins of a `vite.config` go in,
 * what is left alone when there is nothing to read, and a project's alias, plugin and PostCSS reaching a real Vite server.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createServer, type Plugin } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { type AppBuild, appBuildLine, appBuildOf, appBuildPlan } from "../bin/forgebook/appBuild/appBuild.ts";
import {
  appConfigFields,
  guardedAppPlugin,
  holdsNothingForCatalogue,
  keepsAppPlugin,
  viteConfigFile,
  withoutWholeEnvironment
} from "../bin/forgebook/appBuild/appViteConfig.ts";
import { hasTsconfigPaths, namedTsconfigs } from "../bin/forgebook/appBuild/tsconfigPaths.ts";
import { commandServerVite } from "../bin/forgebook/commandServer.ts";
import { type AppBuildOption, appBuildProblem, resolvedAppBuild } from "../src/vite/appBuildOption.ts";
import { type ResolvedConfig, resolveConfig } from "../src/vite/configFile.ts";
import { inlineCssImports } from "../src/vite/cssImports.ts";
import { PostcssConfigError, postcssConfigPlace, projectPostcss } from "../src/vite/projectPostcss.ts";

const made: string[] = [];

/** A folder holding these files, removed after the test. */
const projectWith = (files: Readonly<Record<string, string>>): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "forgebook-app-build-")));
  made.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  // a project's configuration imports Vite as any project's does
  mkdirSync(join(dir, "node_modules"));
  symlinkSync(join(import.meta.dirname, "..", "node_modules", "vite"), join(dir, "node_modules", "vite"));
  return dir;
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A catalogue's configuration, as far as the app's build is concerned. */
const catalogue = (dir: string, framework = "react", option?: AppBuildOption): ResolvedConfig =>
  resolveConfig(
    {
      title: "A catalogue",
      stories: ["src/**/*.stories.tsx"],
      framework: { name: framework, docsModule: "", pages: { frame: "", code: "" } },
      ...(option === undefined ? {} : { appBuild: option })
    },
    dir
  );

/** Reads a project's build as `forgebook dev` does. */
const read = (config: ResolvedConfig): Promise<AppBuild> =>
  appBuildOf(config, { command: "serve", mode: "development" });

describe("tsconfig paths", () => {
  it("finds them in the file itself, with its comments", () => {
    const dir = projectWith({
      "tsconfig.json": '{\n  // Vite\'s template\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}'
    });
    expect(hasTsconfigPaths(dir)).toBe(true);
  });

  it("follows `references`, where Vite's template keeps them", () => {
    const dir = projectWith({
      "tsconfig.json": '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }',
      "tsconfig.app.json": '{ "compilerOptions": { "paths": { "~/*": ["./src/*"] } } }'
    });
    expect(hasTsconfigPaths(dir)).toBe(true);
  });

  it("follows `extends`, one or a list, up to a workspace's base", () => {
    const dir = projectWith({
      "tsconfig.base.json": '{ "compilerOptions": { "paths": { "@acme/*": ["./packages/*"] } } }',
      "apps/web/tsconfig.json": '{ "extends": ["../../tsconfig.base.json"] }'
    });
    expect(hasTsconfigPaths(join(dir, "apps", "web"))).toBe(true);
  });

  it("says no for a project without any, and leaves a package's configuration unread", () => {
    expect(hasTsconfigPaths(projectWith({}))).toBe(false);
    expect(
      hasTsconfigPaths(projectWith({ "tsconfig.json": '{ "extends": "@tsconfig/strictest/tsconfig.json" }' }))
    ).toBe(false);
    expect(namedTsconfigs('{ "extends": "@tsconfig/node24" }')).toEqual([]);
    expect(namedTsconfigs('{ "references": [{ "path": "tsconfig.app.json" }] }')).toEqual([
      "tsconfig.app.json"
    ]);
  });

  it("does not go round a loop", () => {
    const dir = projectWith({
      "tsconfig.json": '{ "extends": "./a.json" }',
      "a.json": '{ "extends": "./tsconfig.json" }'
    });
    expect(hasTsconfigPaths(dir)).toBe(false);
  });
});

describe("which plugins go in", () => {
  const options = resolvedAppBuild(undefined);

  it.each([
    ["vite:react-babel", "react"],
    ["vite:react-refresh", "react"],
    ["@vitejs/plugin-react-swc", "react"],
    ["vite:vue", "vue"],
    ["vite-plugin-svelte", "svelte"],
    ["solid", "solid"]
  ])("leaves out %s on %s: the adapter gives its own", (name, framework) => {
    expect(keepsAppPlugin(name, framework, options)).toBe(false);
  });

  it.each([
    "tanstack:router-generator",
    "react-router",
    "vite-plugin-pwa:build",
    "sentry-vite-plugin",
    "forgebook"
  ])("leaves out %s: it builds an app, or is the catalogue itself", (name) => {
    expect(keepsAppPlugin(name, "react", options)).toBe(false);
  });

  it.each(["@tailwindcss/vite:scan", "vite-plugin-svgr", "vite:vue-jsx", "unocss:global"])(
    "keeps %s",
    (name) => {
      expect(keepsAppPlugin(name, "react", options)).toBe(true);
    }
  );

  it("keeps a framework's plugin on another framework's catalogue", () => {
    expect(keepsAppPlugin("vite:vue", "react", options)).toBe(true);
  });

  it("does as the configuration asks over its own lists", () => {
    const asked = resolvedAppBuild({ skipPlugins: ["vite-plugin-svgr"], keepPlugins: ["react-router"] });
    expect(keepsAppPlugin("vite-plugin-svgr", "react", asked)).toBe(false);
    expect(keepsAppPlugin("react-router", "react", asked)).toBe(true);
  });
});

describe("whether a vite.config is worth loading", () => {
  it("skips the configuration a new project is born with", () => {
    expect(
      holdsNothingForCatalogue(
        "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n"
      )
    ).toBe(true);
  });

  it.each([
    ["a plugin of its own", 'import x from "vite-plugin-x";\nexport default { plugins: [x()] };'],
    ["a file of its own", 'import x from "./x";\nexport default x;'],
    ["a dynamic import", 'export default async () => (await import("./x")).default;'],
    ["a require", 'module.exports = require("./x");'],
    ["an alias", 'export default { resolve: { alias: { "@": "/src" } } };'],
    ["a define", "export default { define: { A: 1 } };"],
    ["a plugin written in the file", 'export default { plugins: [{ name: "md", transform() {} }] };']
  ])("loads one with %s", (_name, text) => {
    expect(holdsNothingForCatalogue(text)).toBe(false);
  });
});

describe("what is taken of a vite.config", () => {
  it("takes how modules and style sheets resolve, never the app's page, server or output", () => {
    const fields = appConfigFields(
      {
        root: "web",
        base: "/app/",
        build: { outDir: "out" },
        server: { port: 1 },
        resolve: { alias: { "@": "/src" }, dedupe: ["react"] },
        css: { transformer: "postcss", preprocessorOptions: { scss: { additionalData: "$a: 1;" } } },
        define: { A: "1" },
        publicDir: "static",
        envDir: "env"
      },
      "/project"
    );
    expect(fields).toEqual({
      resolve: { alias: { "@": "/src" }, dedupe: ["react"] },
      css: { preprocessorOptions: { scss: { additionalData: "$a: 1;" } } },
      define: { A: "1" },
      publicDir: "/project/web/static",
      envDir: "/project/web/env"
    });
  });

  it("finds Vite's names, a path named, or none when turned off", () => {
    const dir = projectWith({ "vite.config.mts": "export default {};" });
    expect(viteConfigFile(dir, undefined)).toBe("vite.config.mts");
    expect(viteConfigFile(dir, "other.ts")).toBe("other.ts");
    expect(viteConfigFile(dir, false)).toBeUndefined();
  });
});

describe("a project with nothing to read", () => {
  it("adds no plugin", async () => {
    const dir = projectWith({ "src/a.ts": "export {};" });
    const { plugins, report } = await read(catalogue(dir));
    expect(plugins).toEqual([]);
    expect(appBuildLine(report)).toBeUndefined();
  });

  it("does not load the configuration a new project is born with", async () => {
    // loading it would throw: nothing here can be imported
    const dir = projectWith({
      "vite.config.ts":
        "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n"
    });
    const { plugins, report } = await read(catalogue(dir));
    expect(plugins).toEqual([]);
    expect(report.viteConfig).toBeUndefined();
    expect(report.problems).toEqual([]);
  });
});

describe("turning it off", () => {
  const files = {
    "vite.config.mjs": 'export default { define: { A: "1" } };',
    "tsconfig.json": '{ "compilerOptions": { "paths": {} } }',
    "postcss.config.json": '{ "plugins": {} }'
  };

  it("reads nothing with `false`", async () => {
    const { plugins, report } = await read(catalogue(projectWith(files), "react", false));
    expect(plugins).toEqual([]);
    expect(report).toMatchObject({ viteConfig: undefined, tsconfigPaths: false, postcss: false });
  });

  it("reads each part unless it is turned off", async () => {
    const dir = projectWith(files);
    expect((await read(catalogue(dir))).report).toMatchObject({
      viteConfig: "vite.config.mjs",
      tsconfigPaths: true,
      postcss: true
    });
    expect((await read(catalogue(dir, "react", { viteConfig: false }))).report.viteConfig).toBeUndefined();
    expect((await read(catalogue(dir, "react", { tsconfigPaths: false }))).report.tsconfigPaths).toBe(false);
    expect((await read(catalogue(dir, "react", { postcss: false }))).report.postcss).toBe(false);
  });

  it("leaves to an adapter what it reads itself", async () => {
    const { report } = await read(catalogue(projectWith(files), "nextjs"));
    expect(report).toMatchObject({ viteConfig: undefined, tsconfigPaths: false, postcss: false });
    expect((await read(catalogue(projectWith(files), "react-native-web"))).report.postcss).toBe(false);
  });

  it.each([
    [true, "`appBuild` is false"],
    [{ viteConfig: 1 }, "`appBuild.viteConfig`"],
    [{ postcss: "yes" }, "`appBuild.postcss`"],
    [{ skipPlugins: "x" }, "`appBuild.skipPlugins`"]
  ])("refuses %j", (value, message) => {
    expect(appBuildProblem(value)).toContain(message);
  });

  it("takes what the type takes", () => {
    for (const value of [undefined, false, {}, { viteConfig: false }, { keepPlugins: ["a"], postcss: false }])
      expect(appBuildProblem(value)).toBeUndefined();
  });
});

describe("a configuration that fails", () => {
  it("does not stop the catalogue, and says what to do", async () => {
    const dir = projectWith({
      "vite.config.mjs": 'throw new Error("no secret set");\nexport default { define: {} };'
    });
    const { report } = await read(catalogue(dir));
    expect(report.viteConfig).toBeUndefined();
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain("no secret set");
    expect(report.problems[0]).toContain("appBuild");
  });
});

describe("what init is told, with nothing run", () => {
  it("names the files whose code runs, and not a JSON file's", () => {
    // a file that would throw if it ran
    const dir = projectWith({
      "vite.config.mjs": 'throw new Error("ran");\nexport default { define: {} };',
      "postcss.config.json": "{}",
      "tsconfig.json": '{ "compilerOptions": { "paths": {} } }'
    });
    expect(appBuildPlan(dir, "react")).toEqual({
      viteConfig: "vite.config.mjs",
      tsconfigPaths: true,
      postcss: "postcss.config.json",
      // the plugins a JSON file names run too
      runsCode: ["vite.config.mjs", "postcss.config.json"]
    });
  });

  it("names the script of a PostCSS configuration", () => {
    const dir = projectWith({ "postcss.config.cjs": "module.exports = {};" });
    expect(appBuildPlan(dir, "vue").runsCode).toEqual(["postcss.config.cjs"]);
  });
});

describe("where a PostCSS configuration is", () => {
  it("is found above a package, up to the repository's root and no further", () => {
    const dir = projectWith({
      "postcss.config.cjs": "module.exports = {};",
      "repo/.git/HEAD": "",
      "repo/apps/web/src/a.css": ""
    });
    expect(postcssConfigPlace(join(dir, "repo", "apps", "web"))).toBeUndefined();
    const workspace = projectWith({ ".git/HEAD": "", "postcss.config.cjs": "", "apps/web/a.css": "" });
    expect(postcssConfigPlace(join(workspace, "apps", "web"))?.file).toBe(
      join(workspace, "postcss.config.cjs")
    );
  });

  it("is read from a package.json's key", () => {
    const dir = projectWith({ "package.json": '{ "postcss": { "plugins": {} } }' });
    expect(postcssConfigPlace(dir)).toEqual({
      kind: "package",
      file: join(dir, "package.json"),
      config: { plugins: {} }
    });
  });
});

describe("how far a plugin of the app's reaches", () => {
  const hookOf = (plugin: Plugin, name: "config" | "configureServer" | "transformIndexHtml"): unknown =>
    plugin[name];

  it("takes from what its config returns what is taken of a file", async () => {
    const plugin = guardedAppPlugin(
      { name: "p", config: () => ({ server: { host: "0.0.0.0" }, base: "/x/", define: { A: "1" } }) },
      "/project"
    );
    const hook = hookOf(plugin, "config");
    const handler = typeof hook === "object" && hook !== null && "handler" in hook ? hook.handler : undefined;
    expect(
      typeof handler === "function" ? await Reflect.apply(handler, undefined, [{}, {}]) : "none"
    ).toEqual({
      define: { A: "1" }
    });
  });

  it("runs its server hook in the normal order, after the guards", () => {
    const server = (): void => undefined;
    const plugin = guardedAppPlugin({ name: "p", configureServer: { order: "pre", handler: server } }, "/");
    expect(hookOf(plugin, "configureServer")).toBe(server);
  });

  it("changes the frames' page and not the catalogue's", async () => {
    const plugin = guardedAppPlugin({ name: "p", transformIndexHtml: () => "changed" }, "/");
    const hook = hookOf(plugin, "transformIndexHtml");
    const handler = typeof hook === "object" && hook !== null && "handler" in hook ? hook.handler : undefined;
    const run = (path: string): unknown =>
      typeof handler === "function" ? Reflect.apply(handler, undefined, ["html", { path }]) : "none";
    expect(run("/index.html")).toBe("html");
    expect(run("/frame.html")).toBe("changed");
  });
});

describe("a define that writes out an environment", () => {
  it("is left out, and an empty one or another name is kept", () => {
    expect(
      withoutWholeEnvironment({ "process.env": { KEY: "secret" }, "process.env.A": '"1"', B: "2" })
    ).toEqual({ "process.env.A": '"1"', B: "2" });
    expect(withoutWholeEnvironment({ "process.env": {} })).toEqual({ "process.env": {} });
    expect(withoutWholeEnvironment({ "import.meta.env": "{}" })).toEqual({ "import.meta.env": "{}" });
  });
});

describe("a plugin that does the same as Vite's reading of paths", () => {
  it("stays when Vite does not read them here", () => {
    const options = resolvedAppBuild(undefined);
    expect(keepsAppPlugin("vite-tsconfig-paths", "react", options, true)).toBe(false);
    expect(keepsAppPlugin("vite-tsconfig-paths", "react", options, false)).toBe(true);
  });
});

describe("what is said of a configuration", () => {
  it("names what a catalogue cannot do", async () => {
    const dir = projectWith({
      "vite.config.mjs":
        'export default { css: { modules: { localsConvention: "camelCase" } } };\n// jsxImportSource'
    });
    const { report } = await read(catalogue(dir));
    expect(report.problems.join()).toContain("css.modules is not read");
    expect(report.problems.join()).toContain("jsxImportSource is not read");
  });
});

describe("a PostCSS configuration", () => {
  const css = (dir: string): Promise<string> =>
    projectPostcss(dir)?.("a { color: RAW; }", join(dir, "a.css")).then((result) => result.css) ??
    Promise.reject(new Error("none"));

  it("may be a function, as PostCSS's loader reads it", async () => {
    const dir = projectWith({
      "postcss.config.cjs":
        'module.exports = () => ({ plugins: [{ postcssPlugin: "p", Declaration: (node) => { node.value = "red"; } }] });'
    });
    expect(await css(dir)).toContain("red");
  });

  it("that cannot load is told apart, and is read again on the next sheet", async () => {
    const dir = projectWith({ "postcss.config.cjs": 'throw new Error("broken");' });
    await expect(css(dir)).rejects.toBeInstanceOf(PostcssConfigError);
    const run = projectPostcss(dir);
    await expect(run?.("a{}", join(dir, "a.css"))).rejects.toBeInstanceOf(PostcssConfigError);
    writeFileSync(join(dir, "postcss.config.json"), '{ "plugins": {} }');
  });

  it("sees the sheets a sheet imports by relative path", () => {
    const dir = projectWith({
      "src/parts/b.css": "@import './c.css';\n.b { background: url(./i.png); }",
      "src/parts/c.css": ".c { color: red; }",
      "src/loop.css": "@import './loop.css';"
    });
    const { css: text, files } = inlineCssImports(
      '@import "./parts/b.css";\n@import "tailwindcss";\n@import "./gone.css";\n@import "./parts/c.css" layer(x);',
      join(dir, "src", "a.css")
    );
    expect(text).toContain(".c { color: red; }");
    expect(text).toContain("url(parts/./i.png)");
    expect(text).toContain('@import "tailwindcss";');
    expect(text).toContain('@import "./gone.css";');
    expect(text).toContain("layer(x)");
    expect(files).toHaveLength(2);
    expect(inlineCssImports("@import './loop.css';", join(dir, "src", "loop.css")).css).toContain("@import");
  });
});

describe("a plugin that logs", () => {
  it("stays off a command's stdout, which is its answer", async () => {
    const { log, info, debug } = console;
    const before = { log, info, debug };
    try {
      await commandServerVite(catalogue(projectWith({})), {});
      const { log: logged, info: informed, debug: debugged, error } = console;
      expect([logged, informed, debugged]).toEqual([error, error, error]);
    } finally {
      Object.assign(console, before);
    }
  });
});

describe("on a real Vite server", () => {
  it("resolves the app's alias, and `tsconfig` paths, and runs its plugin and its PostCSS", async () => {
    const dir = projectWith({
      "vite.config.mjs": `
        import { resolve } from "node:path";
        const stamp = { name: "app-stamp", transform: (code, id) => id.endsWith("/stamped.js") ? code.replace("RAW", "STAMPED") : null };
        export default { plugins: [stamp, { name: "vite:react-babel", transform: () => { throw new Error("ran twice"); } }], resolve: { alias: { "@aliased": resolve(import.meta.dirname, "src/aliased.js") } }, define: { __FROM_APP__: "1" }, base: "/never/" };
      `,
      "tsconfig.json": '{ "compilerOptions": { "paths": { "~/*": ["./src/*"] } } }',
      "postcss.config.cjs":
        'module.exports = { plugins: [{ postcssPlugin: "rename", Declaration: (node) => { if (node.value === "RAWCOLOR") node.value = "red"; } }] };',
      "src/entry.ts":
        'import "@aliased";\nimport "~/paths.ts";\nimport "./stamped.js";\nexport const a = __FROM_APP__;\n',
      "src/aliased.js": "export const aliased = 1;",
      "src/paths.ts": "export const paths = 1;",
      "src/stamped.js": 'export const stamped = "RAW";',
      "src/look.css": "a { color: RAWCOLOR; }"
    });
    const app = await read(catalogue(dir));
    expect(app.report.plugins).toEqual(["app-stamp"]);
    expect(app.report.leftOutPlugins).toEqual(["vite:react-babel"]);
    expect(appBuildLine(app.report)).toBe(
      "Drawing with the app's build: vite.config.mjs (app-stamp), tsconfig paths, PostCSS"
    );
    const server = await createServer({
      root: dir,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true },
      css: { transformer: "lightningcss" },
      plugins: [...app.plugins]
    });
    try {
      expect(server.config.base).toBe("/");
      const entry = await server.transformRequest("/src/entry.ts");
      expect(entry?.code).toContain("/src/aliased.js");
      expect(entry?.code).toContain("/src/paths.ts");
      const stamped = await server.transformRequest("/src/stamped.js");
      expect(stamped?.code).toContain("STAMPED");
      const look = await server.transformRequest("/src/look.css");
      expect(look?.code).toContain("red");
      expect(look?.code).not.toContain("RAWCOLOR");
    } finally {
      await server.close();
    }
  }, 60_000);
});
