/**
 * Tests for the parts of `forgebook init` that hold logic: which framework and package manager a project says, what its
 * entries say, and the floors against the adapters' own `package.json`.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  detectPackageManager,
  forgebookRunner,
  installArguments,
  spawnedCommand,
  workspaceRootFlags
} from "../bin/forgebook/newProject/packageManagers.ts";
import {
  angularProviders,
  angularStyles,
  bodyIds,
  markupWrappers,
  pageFacts,
  styleSheetImports,
  viteConfigFacts,
  vueInstalls
} from "../bin/forgebook/newProject/projectEntries.ts";
import {
  detectFramework,
  FRAMEWORK_NAMES,
  PROJECT_FRAMEWORKS
} from "../bin/forgebook/newProject/projectFrameworks.ts";
import {
  installSpecifier,
  isBelowFloor,
  packageState,
  requiredPackages
} from "../bin/forgebook/newProject/projectPackages.ts";

/** The packages folder, whose manifests the floors repeat. */
const PACKAGES = join(import.meta.dirname, "..", "..");

const root = mkdtempSync(join(tmpdir(), "forgebook-new-project-parts-"));

afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A `package.json`'s required peers, without `forgebook`, each with the lowest version its range takes. */
const requiredPeers = (folder: string): Readonly<Record<string, string>> => {
  const manifest = JSON.parse(readFileSync(join(PACKAGES, folder, "package.json"), "utf8"));
  const optional = manifest.peerDependenciesMeta ?? {};
  return Object.fromEntries(
    Object.entries<string>(manifest.peerDependencies ?? {}).flatMap(([name, range]) =>
      name === "forgebook" || optional[name]?.optional === true
        ? []
        : [[name, range.replace(/^[\^>=~]+/, "").split(/\s/)[0] ?? ""]]
    )
  );
};

/** Which framework a list of packages says. */
const detect = (...names: readonly string[]): ReturnType<typeof detectFramework> =>
  detectFramework(new Map(names.map((name) => [name, "^1.0.0"])));

describe("the framework a project says", () => {
  it.each([
    [["react", "react-dom"], "react"],
    [["next", "react", "react-dom"], "nextjs"],
    [["vue"], "vue"],
    [["nuxt", "vue"], "nuxt"],
    [["svelte"], "svelte"],
    [["@sveltejs/kit", "svelte"], "sveltekit"],
    [["solid-js"], "solid"],
    [["preact"], "preact"],
    [["lit"], "web-components"],
    [["@angular/core", "rxjs"], "angular"],
    [["react-native", "react"], "react-native-web"],
    [["expo", "react", "react-native"], "react-native-web"],
    [["vue", "react", "@forgebook/vue"], "vue"],
    [["@forgebook/nextjs", "@forgebook/react", "next", "react"], "nextjs"]
  ])("reads %j as %s", (names, framework) => {
    expect(detect(...names)).toEqual({ kind: "found", framework });
  });

  it("takes Preact standing in for React as Preact", () => {
    expect(
      detectFramework(
        new Map([
          ["preact", "^10.19.0"],
          ["react", "npm:@preact/compat@^18"]
        ])
      )
    ).toEqual({
      kind: "found",
      framework: "preact"
    });
  });

  it("names both where two stand on their own, and says nothing of none", () => {
    expect(detect("react", "vue")).toEqual({ kind: "ambiguous", candidates: ["react", "vue"] });
    expect(detect("next", "react-native")).toEqual({
      kind: "ambiguous",
      candidates: ["nextjs", "react-native-web"]
    });
    expect(detect("lodash")).toEqual({ kind: "unknown" });
  });
});

describe("the floors", () => {
  it("are the adapters' own required peers", () => {
    for (const name of FRAMEWORK_NAMES) expect(PROJECT_FRAMEWORKS[name].peers).toEqual(requiredPeers(name));
    // its React and its Vite are its own, so a project on older ones still installs it, beside them
    expect(requiredPeers("forgebook")).toEqual({});
  });

  it.each([
    ["^18.3.1", "19.0.0", true],
    ["18.3.1", "19.0.0", true],
    ["19.0.0", "19.0.0", false],
    ["^18.2.0 || ^19.0.0", "19.0.0", false],
    ["~8.3.3", "8.3.4", false],
    ["~8.2.0", "8.3.4", true],
    ["8.x", "8.3.4", false],
    ["7.x", "8.3.4", true],
    ["8.3.3", "8.3.4", true],
    ["^8.0.1", "8.3.4", false],
    ["^5.0.0", "5.46.4", false],
    [">=16.8.0", "19.0.0", false],
    [">=18.0.0 <20.0.0", "19.0.0", false],
    [">=17 <19", "19.0.0", true],
    ["^0.20.0", "0.21.0", true],
    ["^0.21.2", "0.21.0", false],
    ["0.81.4", "0.76.0", false],
    ["workspace:*", "19.0.0", false],
    ["latest", "19.0.0", false],
    ["catalog:", "19.0.0", false],
    ["npm:@preact/compat@^18", "19.0.0", false]
  ])("reads %s against %s as below: %s", (version, floor, isBelow) => {
    expect(isBelowFloor(version, floor)).toBe(isBelow);
  });

  it("pins Angular's missing packages to the project's major", () => {
    const declared = new Map([["@angular/core", "^20.1.0"]]);
    expect(installSpecifier("@angular/build", declared)).toBe("@angular/build@^20.0.0");
    expect(installSpecifier("vite", declared)).toBe("vite");
  });

  it("asks for the adapter's floor, and nothing of a project's Vite", () => {
    expect(requiredPackages("react", []).get("react")).toBe("18.2.0");
    expect(requiredPackages("react", []).has("vite")).toBe(false);
    expect(requiredPackages("react-native-web", ["@babel/core"]).has("@babel/core")).toBe(true);
  });

  it("tells a declared old version from one that came with something else", () => {
    const dir = join(root, "state");
    mkdirSync(join(dir, "node_modules", "vite"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "lit"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "vite", "package.json"), '{ "version": "5.0.0" }');
    writeFileSync(join(dir, "node_modules", "lit", "package.json"), '{ "version": "2.0.0" }');
    const state = packageState(dir, new Map([["lit", "^2.0.0"]]), requiredPackages("web-components", []));
    expect(state.tooOld).toEqual([{ name: "lit", found: "2.0.0", floor: "3.2.0" }]);
    expect(state.missing).toEqual(["forgebook", "@forgebook/web-components"]);
  });
});

describe("the package manager", () => {
  it("reads packageManager before a lock file, up to the repository's root", () => {
    const top = join(root, "repo");
    const inner = join(top, "packages", "ui");
    mkdirSync(join(top, ".git"), { recursive: true });
    mkdirSync(inner, { recursive: true });
    expect(detectPackageManager(inner)).toEqual({ name: "npm", detectedFrom: undefined });
    // a lock file in a parent decides nothing unless the parent declares a workspace
    writeFileSync(join(top, "yarn.lock"), "");
    expect(detectPackageManager(inner)).toEqual({ name: "npm", detectedFrom: undefined });
    writeFileSync(join(top, "package.json"), '{ "workspaces": ["packages/*"] }');
    expect(detectPackageManager(inner)).toEqual({ name: "yarn", detectedFrom: "../../yarn.lock" });
    expect(workspaceRootFlags("yarn", top)).toEqual(["-W"]);
    expect(workspaceRootFlags("yarn", inner)).toEqual([]);
    writeFileSync(join(top, "package.json"), '{ "workspaces": [], "packageManager": "pnpm@10.19.0" }');
    expect(detectPackageManager(inner).name).toBe("pnpm");
    expect(workspaceRootFlags("pnpm", top)).toEqual(["--workspace-root"]);
    const pnpmRoot = join(root, "pnpm-root");
    mkdirSync(pnpmRoot);
    writeFileSync(join(pnpmRoot, "pnpm-workspace.yaml"), "");
    expect(detectPackageManager(pnpmRoot).name).toBe("pnpm");
  });

  it("writes each one's commands", () => {
    expect(installArguments("npm", ["a"], [])).toEqual(["install", "--save-dev", "a"]);
    expect(installArguments("pnpm", ["a"], ["--workspace-root"])).toEqual([
      "add",
      "--save-dev",
      "--workspace-root",
      "a"
    ]);
    expect(installArguments("yarn", ["a"], ["-W"])).toEqual(["add", "--dev", "-W", "a"]);
    expect(installArguments("bun", [], [])).toEqual(["install"]);
    expect(forgebookRunner("bun")).toBe("bunx forgebook");
    const shell = "C:\\Windows\\cmd.exe";
    expect(spawnedCommand("npm", ["install"], { ComSpec: shell }, "win32")).toEqual({
      program: shell,
      args: ["/d", "/s", "/c", "npm", "install"],
      env: { ComSpec: shell, NoDefaultCurrentDirectoryInExePath: "1" }
    });
    expect(spawnedCommand("npm", ["install"], {}, "linux")).toEqual({
      program: "npm",
      args: ["install"],
      env: {}
    });
  });
});

describe("what an entry says", () => {
  it("keeps a planted text from taking long", () => {
    const start = performance.now();
    viteConfigFacts(`import${" ".repeat(200_000)}`);
    viteConfigFacts(`from${" ".repeat(200_000)}`);
    pageFacts("<link ".repeat(40_000));
    isBelowFloor(" ".repeat(200_000), "19.0.0");
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("finds the style sheets that load for everything, not a module's", () => {
    const text = [
      'import "./index.css";',
      "import './theme.scss';",
      'import styles from "./Button.module.css";',
      'import "./polyfill";',
      '// import "./commented.css";',
      '  import "bootstrap/dist/css/bootstrap.min.css";'
    ].join("\n");
    expect(styleSheetImports(text)).toEqual([
      "./index.css",
      "./theme.scss",
      "bootstrap/dist/css/bootstrap.min.css"
    ]);
  });

  it("names the wrappers that close, not a leaf or React's own", () => {
    expect(
      markupWrappers(
        "<StrictMode><ThemeProvider theme={t}><Router.Root><Header /><App /></Router.Root></ThemeProvider></StrictMode>"
      )
    ).toEqual(["Router.Root", "ThemeProvider"]);
    expect(vueInstalls("createApp(App).use(router).use(createPinia()).mount('#app')")).toEqual([
      "router",
      "createPinia"
    ]);
    expect(angularProviders("providers: [provideRouter(r), provideZoneChangeDetection()]")).toEqual([
      "provideRouter"
    ]);
  });

  it("reads a page's scripts, links and body", () => {
    expect(
      pageFacts(
        '<head><link rel="stylesheet" href="/a.css"><link rel="icon" href="/i.svg"><link href="https://f.example/x.css" rel="stylesheet"></head><body><div id="root"></div><script type="module" src="/src/main.ts"></script><script src="https://x.example/y.js"></script></body>'
      )
    ).toEqual({
      scripts: ["/src/main.ts"],
      styleSheets: ["/a.css"],
      remoteLinks: ["https://f.example/x.css"],
      bodyIds: ["root"]
    });
    expect(bodyIds('<body><div id="a" /><div id={computed} /></body>')).toEqual(["a"]);
  });

  it("reads Angular's injected styles from either key, and leaves out what it cannot read", () => {
    const project = (styles: unknown, key = "architect"): unknown => ({
      projects: { app: { [key]: { build: { options: { styles } } } } }
    });
    expect(angularStyles(project(["a.css", { input: "b.css" }, { input: "c.css", inject: false }]))).toEqual([
      "a.css",
      "b.css"
    ]);
    expect(angularStyles(project(["a.css"], "targets"))).toEqual(["a.css"]);
    expect(
      angularStyles({
        projects: {
          lib: { projectType: "library" },
          app: { projectType: "application", architect: { build: { options: { styles: ["a.css"] } } } }
        }
      })
    ).toEqual(["a.css"]);
    expect(angularStyles(undefined)).toEqual([]);
  });

  it("names a vite.config's plugins, not the framework's own or Node's", () => {
    expect(
      viteConfigFacts(
        'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport path from "node:path";\nimport svgr from "vite-plugin-svgr";\nimport mine from "./mine";\nexport default defineConfig({ plugins: [react(), svgr()] });'
      )
    ).toEqual({ plugins: ["vite-plugin-svgr"], hasAlias: false });
    expect(
      viteConfigFacts(
        'import path from "path";\nimport {\n  visualizer\n} from "rollup-plugin-visualizer";\n/* import old from "old-plugin"; */\n'
      ).plugins
    ).toEqual(["rollup-plugin-visualizer"]);
    expect(viteConfigFacts("resolve: { alias: {} }").hasAlias).toBe(true);
  });
});
