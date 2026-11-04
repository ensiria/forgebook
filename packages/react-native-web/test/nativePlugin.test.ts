/**
 * Tests for the Vite plugins, building a small React Native project with them: `react-native` drawn by
 * react-native-web, the web's files first, Flow and JSX in `.js` compiled, an image `require`d, `__DEV__` defined, a
 * deep import refused; and the configuration the dev server and its Node side get.
 *
 * @module
 */
import { join } from "node:path";

import { codeLiteral } from "forgebook/code-literal";
import { build, type Rolldown, type UserConfig } from "vite";
import { describe, expect, it } from "vitest";

import { nativeConfig, nativePlugins, prebundlePlugin } from "../src/vite/nativePlugin.ts";

/** The small project the build compiles. */
const PROJECT = join(import.meta.dirname, "project");

/**
 * The project built as a library, with the plugins, kept in memory.
 *
 * @param entry - the entry module, from the project's folder.
 * @returns the built code of every chunk, and the assets' names.
 */
const built = async (
  entry: string
): Promise<{ readonly code: string; readonly assets: readonly string[] }> => {
  const result = await build({
    root: PROJECT,
    configFile: false,
    logLevel: "silent",
    plugins: nativePlugins({}),
    build: {
      write: false,
      minify: true,
      lib: { entry: join(PROJECT, entry), formats: ["es"], fileName: "entry" },
      rolldownOptions: { external: [/^react(?:-dom)?(?:\/|$)/] }
    }
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((each) =>
    "output" in each ? each.output : []
  );
  const chunks = outputs.filter((output): output is Rolldown.OutputChunk => output.type === "chunk");
  return {
    code: chunks.map((chunk) => chunk.code).join("\n"),
    assets: outputs.filter((output) => output.type === "asset").map((output) => output.fileName)
  };
};

describe("a React Native project built with the plugins", () => {
  it("draws react-native with react-native-web, reads the web's file, compiles Flow and JSX in .js", async () => {
    const { code } = await built("entry.tsx");
    expect(code).toContain("web file");
    expect(code).not.toContain("native file");
    // react-native-web's own modules are in the bundle, and React Native's are not
    expect(code).toMatch(/react-native-web/);
    expect(code).not.toMatch(/from ["']react-native["']/);
    expect(code).not.toContain("BadgeProps");
    // a build is not development: `__DEV__` is false, so the badge's development branch is gone
    expect(code).not.toMatch(/dev \$\{/);
  });

  it("writes an image's require as its address, the image an asset of the build", async () => {
    const { code, assets } = await built("entry.tsx");
    expect(code).not.toContain('require("./logo.png")');
    expect(code).toMatch(/logo-[\w-]+\.png|data:image\/png/);
    expect(assets.length + (code.includes("data:image/png") ? 1 : 0)).toBeGreaterThan(0);
  });

  it("refuses a deep import of React Native's own files, naming the module and why", async () => {
    await expect(built("deep.ts")).rejects.toThrow(
      /react-native\/Libraries\/Utilities\/codegenNativeComponent.*one of React Native's own files/
    );
  });
});

describe("the dev server's pre-bundling of a package written for React Native", () => {
  it("strips Flow, reads the file as JSX and writes an image's require as its address, as a build does", async () => {
    const hook = prebundlePlugin([]).transform;
    if (typeof hook !== "object" || !("handler" in hook)) throw new Error("no transform handler");
    const code =
      '// @flow\nexport const icon: string = require("./a.png");\nexport const Badge = () => <b />;\n';
    const result: unknown = await Reflect.apply(hook.handler, undefined, [
      code,
      "/app/node_modules/react-native-foo/index.js",
      { moduleType: "js" }
    ]);
    if (
      typeof result !== "object" ||
      result === null ||
      !("code" in result) ||
      typeof result.code !== "string"
    )
      throw new Error("nothing compiled");
    expect(result).toMatchObject({ moduleType: "jsx" });
    expect(result.code).not.toContain(": string");
    expect(result.code).not.toContain('require("./a.png")');
    expect(result.code).toContain(`import __fbAsset0 from ${codeLiteral("./a.png")};`);
    expect(result.code).toContain("<b />");
  });

  it("leaves a package not written for React Native as its publisher ships it", async () => {
    const hook = prebundlePlugin([]).transform;
    if (typeof hook !== "object" || !("handler" in hook)) throw new Error("no transform handler");
    const result: unknown = await Reflect.apply(hook.handler, undefined, [
      'export const a = require("./a.png");',
      "/app/node_modules/lodash/a.js",
      { moduleType: "js" }
    ]);
    expect(result).toBeNull();
  });
});

describe("the configuration the plugin gives Vite", () => {
  /** The configuration for a dev server whose story files are `src/**\/*.stories.tsx`. */
  const config: UserConfig = nativeConfig(true, { nativePackages: ["legacy-chart"] }, [
    "src/**/*.stories.tsx"
  ]);

  it("resolves exactly react-native to react-native-web, the web's files first", () => {
    expect(config.resolve?.alias).toEqual([{ find: /^react-native$/, replacement: "react-native-web" }]);
    expect(config.resolve?.extensions?.[0]).toBe(".web.tsx");
  });

  it("defines React Native's globals for the dev server and its pre-bundling", () => {
    expect(config.define?.["__DEV__"]).toBe("true");
    expect(config.optimizeDeps?.rolldownOptions?.transform?.define?.["__DEV__"]).toBe("true");
    expect(config.optimizeDeps?.include).toEqual(["react-native-web"]);
  });

  it("runs the packages written for React Native through Vite on the Node side, pre-bundled from the story files", () => {
    const ssr = config.environments?.["ssr"];
    const noExternal = ssr?.resolve?.noExternal;
    const [pattern] = Array.isArray(noExternal) ? noExternal : [];
    if (!(pattern instanceof RegExp)) throw new Error("no pattern of the packages written for React Native");
    expect(pattern.test("@expo/vector-icons/Ionicons")).toBe(true);
    expect(pattern.test("legacy-chart")).toBe(true);
    expect(pattern.test("react")).toBe(false);
    expect(ssr?.optimizeDeps?.noDiscovery).toBe(false);
    expect(ssr?.optimizeDeps?.entries).toEqual(["src/**/*.stories.tsx"]);
  });
});
