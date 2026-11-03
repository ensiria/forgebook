/**
 * Tests for `forgebook init --from storybook` on React Native projects: Storybook's React Native Web framework, its
 * older addon and on-device Storybook (`.rnstorybook`) moved to `@forgebook/react-native-web`, with the packages they
 * compiled and what Forgebook does not read named.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { expandedGlobs, importStorybook } from "../bin/forgebook/importers/storybook.ts";
import {
  type FrameworkSettings,
  frameworkPeers,
  frameworkSettings,
  storybookPackage
} from "../bin/forgebook/importers/storybookFrameworks.ts";
import { initConfigText } from "../bin/forgebook/initConfig.ts";

const scratch = mkdtempSync(join(tmpdir(), "forgebook-import-native-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/**
 * A project with a Storybook folder holding a `main.ts`.
 *
 * @param name - the project's folder, in the scratch folder.
 * @param folder - Storybook's folder (`.storybook`, `.rnstorybook`).
 * @param main - `main.ts`'s text.
 * @returns the project's folder.
 */
const project = (name: string, folder: string, main: string): string => {
  const dir = join(scratch, name);
  mkdirSync(join(dir, folder), { recursive: true });
  writeFileSync(join(dir, folder, "main.ts"), main);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
  return dir;
};

/**
 * The framework a `main` moves to, as `importStorybook` chooses it, with its options and notes.
 *
 * @param main - `main`'s configuration.
 * @param isOnDevice - whether the project is on-device Storybook's.
 * @returns the settings, or none for a framework Forgebook does not read.
 */
const storybookFramework = (
  main: Readonly<Record<string, unknown>>,
  isOnDevice: boolean
): FrameworkSettings | undefined => {
  const storybook = storybookPackage(main, isOnDevice);
  return storybook === undefined
    ? undefined
    : frameworkSettings(storybook, main, scratch, join(scratch, ".storybook"));
};

describe("Storybook's React Native frameworks", () => {
  it("moves @storybook/react-native-web-vite to react-native-web, with its packages, JSX source, Babel and files", () => {
    const reading = storybookFramework(
      {
        framework: {
          name: "@storybook/react-native-web-vite",
          options: {
            modulesToTranspile: ["react-native-reanimated", "@shopify/flash-list"],
            pluginReactOptions: {
              jsxImportSource: "nativewind",
              babel: {
                plugins: ["@babel/plugin-proposal-export-namespace-from", "react-native-reanimated/plugin"],
                presets: [["nativewind/babel", { mode: "web" }]]
              },
              include: ["src/**"],
              exclude: [/\/legacy\//]
            }
          }
        }
      },
      false
    );
    expect(reading?.framework).toBe("react-native-web");
    expect(frameworkPeers("react-native-web", reading?.options)).toEqual([
      "react-native-web",
      "@rolldown/plugin-babel",
      "@babel/core"
    ]);
    expect(reading?.options).toEqual({
      nativePackages: ["react-native-reanimated", "@shopify/flash-list"],
      jsxImportSource: "nativewind",
      babel: {
        plugins: ["@babel/plugin-proposal-export-namespace-from", "react-native-reanimated/plugin"],
        presets: [["nativewind/babel", { mode: "web" }]]
      },
      include: ["src/**"]
    });
    // a regular expression is not a plain value: named, to copy by hand
    expect(reading?.notes).toEqual([
      "pluginReactOptions.exclude: only names are written; copy the others by hand"
    ]);
  });

  it("moves the older webpack addon to react-native-web, and says Forgebook runs on Vite", () => {
    const reading = storybookFramework(
      {
        framework: "@storybook/react-webpack5",
        addons: [
          {
            name: "@storybook/addon-react-native-web",
            options: {
              modulesToTranspile: ["legacy-chart"],
              babelPlugins: ["react-native-reanimated/plugin", () => 1]
            }
          }
        ]
      },
      false
    );
    expect(reading?.framework).toBe("react-native-web");
    expect(reading?.options).toEqual({
      nativePackages: ["legacy-chart"],
      babel: { plugins: ["react-native-reanimated/plugin"] }
    });
    expect(reading?.notes[0]).toMatch(/ran on webpack/);
    expect(reading?.notes[1]).toMatch(/is not a name/);
    // options that are not plain values would be rewritten by JSON: left out, with a note
    const regex = storybookFramework(
      {
        framework: {
          name: "@storybook/react-native-web-vite",
          options: {
            pluginReactOptions: {
              babel: {
                plugins: [
                  ["x-plugin", { only: /a/ }],
                  ["y-plugin", { on: true }]
                ]
              }
            }
          }
        }
      },
      false
    );
    expect(regex?.options).toEqual({ babel: { plugins: [["y-plugin", { on: true }]] } });
    expect(regex?.notes[0]).toMatch(/a regular expression/);
  });

  it("reads on-device Storybook, which names no framework, and says what does not draw in a browser", () => {
    const reading = storybookFramework(
      { stories: [], deviceAddons: ["@storybook/addon-ondevice-controls"] },
      true
    );
    expect(reading?.framework).toBe("react-native-web");
    expect(reading?.options).toBeUndefined();
    expect(reading?.notes.join("\n")).toMatch(/native module does not draw/);
    // a .storybook folder that names no framework is not on-device Storybook's
    expect(storybookFramework({ stories: [] }, false)).toBeUndefined();
  });

  it("keeps React on Vite as React's", () => {
    expect(storybookFramework({ framework: "/repo/node_modules/@storybook/react-vite" }, false)).toEqual({
      framework: "react",
      options: undefined,
      notes: []
    });
  });
});

describe("an on-device Storybook's folder", () => {
  it("is read from .rnstorybook, its ?(…) glob written out, and written as react-native-web's configuration", async () => {
    const dir = project(
      "on-device",
      ".rnstorybook",
      'export default { stories: ["../components/**/*.stories.?(ts|tsx|js|jsx)"], deviceAddons: [] };\n'
    );
    const imported = await importStorybook(dir);
    if (typeof imported === "string") throw new Error(imported);
    expect(imported.stories).toEqual([
      "components/**/*.stories.ts",
      "components/**/*.stories.tsx",
      "components/**/*.stories.js",
      "components/**/*.stories.jsx"
    ]);
    const text = initConfigText(imported, "Storybook");
    expect(text).toContain('import { reactNativeWeb } from "@forgebook/react-native-web/vite";');
    expect(text).toContain("  framework: reactNativeWeb(),");
  });

  it("is read from .storybook too, for a project on @storybook/react-native before .rnstorybook", async () => {
    const dir = project(
      "on-device-8",
      ".storybook",
      'export default { stories: ["../src/**/*.stories.tsx"] };\n'
    );
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "app", devDependencies: { "@storybook/react-native": "8.6.0" } })
    );
    const imported = await importStorybook(dir);
    if (typeof imported === "string") throw new Error(imported);
    expect(imported.framework).toBe("react-native-web");
    expect(storybookFramework({ framework: "@storybook/react-native" }, false)?.framework).toBe(
      "react-native-web"
    );
  });

  it("writes a framework's options into the configuration", async () => {
    const dir = project(
      "web-vite",
      ".storybook",
      'export default { stories: ["../src/**/*.stories.tsx"], framework: { name: "@storybook/react-native-web-vite", options: { modulesToTranspile: ["legacy-chart"], pluginReactOptions: { jsxImportSource: "nativewind", babel: { plugins: ["react-native-worklets/plugin"] } } } } };\n'
    );
    const imported = await importStorybook(dir);
    if (typeof imported === "string") throw new Error(imported);
    const text = initConfigText(imported, "Storybook");
    expect(text).toContain(
      '  framework: reactNativeWeb({\n    nativePackages: [\n      "legacy-chart"\n    ],'
    );
    expect(text).toContain('    jsxImportSource: "nativewind",');
    expect(text).toContain(
      '    babel: {\n      plugins: [\n        "react-native-worklets/plugin"\n      ]\n    }\n  }),'
    );
  });
});

describe("an optional extglob", () => {
  it("is each of its alternatives, or nothing where nothing still names a file", () => {
    expect(expandedGlobs("src/*.stories.?(ts|tsx)")).toEqual(["src/*.stories.ts", "src/*.stories.tsx"]);
    expect(expandedGlobs("src/*?(.web).tsx")).toEqual(["src/*.web.tsx", "src/*.tsx"]);
    // nothing never leaves two dots, nor an empty folder's name
    expect(expandedGlobs("src/*.?(stories|story).tsx")).toEqual(["src/*.stories.tsx", "src/*.story.tsx"]);
    expect(expandedGlobs("src/?(ui)/*.tsx")).toEqual(["src/ui/*.tsx", "src/*.tsx"]);
  });
});
