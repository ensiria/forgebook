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
import { storybookFramework } from "../bin/forgebook/importers/storybookFrameworks.ts";
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

describe("Storybook's React Native frameworks", () => {
  it("moves @storybook/react-native-web-vite to react-native-web, its modulesToTranspile as nativePackages", () => {
    const reading = storybookFramework(
      {
        framework: {
          name: "@storybook/react-native-web-vite",
          options: {
            modulesToTranspile: ["react-native-reanimated", "@shopify/flash-list"],
            pluginReactOptions: { babel: { plugins: ["react-native-reanimated/plugin"] } }
          }
        }
      },
      false
    );
    expect(reading?.framework).toEqual({
      packageName: "@forgebook/react-native-web",
      adapter: "reactNativeWeb",
      peers: ["react-native-web"],
      options: { nativePackages: ["react-native-reanimated", "@shopify/flash-list"] }
    });
    expect(reading?.notes.join("\n")).toMatch(/pluginReactOptions are not read: .*runs no Babel/);
  });

  it("moves the older webpack addon to react-native-web, and says Forgebook runs on Vite", () => {
    const reading = storybookFramework(
      {
        framework: "@storybook/react-webpack5",
        addons: [{ name: "@storybook/addon-react-native-web", options: { babelPlugins: ["x"] } }]
      },
      false
    );
    expect(reading?.framework.adapter).toBe("reactNativeWeb");
    expect(reading?.framework.options).toBeUndefined();
    expect(reading?.notes[0]).toMatch(/ran on webpack/);
    expect(reading?.notes[1]).toMatch(/babelPlugins are not read/);
  });

  it("reads on-device Storybook, which names no framework, and says what does not draw in a browser", () => {
    const reading = storybookFramework(
      { stories: [], deviceAddons: ["@storybook/addon-ondevice-controls"] },
      true
    );
    expect(reading?.framework.packageName).toBe("@forgebook/react-native-web");
    expect(reading?.notes.join("\n")).toMatch(/native module does not draw/);
    // a .storybook folder that names no framework is not on-device Storybook's
    expect(storybookFramework({ stories: [] }, false)).toBeUndefined();
  });

  it("keeps React on Vite as React's", () => {
    expect(
      storybookFramework({ framework: "/repo/node_modules/@storybook/react-vite" }, false)?.framework
    ).toEqual({
      packageName: "@forgebook/react",
      adapter: "react"
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
    expect(imported.framework.adapter).toBe("reactNativeWeb");
    expect(storybookFramework({ framework: "@storybook/react-native" }, false)?.framework.adapter).toBe(
      "reactNativeWeb"
    );
  });

  it("writes a framework's options into the configuration", async () => {
    const dir = project(
      "web-vite",
      ".storybook",
      'export default { stories: ["../src/**/*.stories.tsx"], framework: { name: "@storybook/react-native-web-vite", options: { modulesToTranspile: ["legacy-chart"] } } };\n'
    );
    const imported = await importStorybook(dir);
    if (typeof imported === "string") throw new Error(imported);
    expect(initConfigText(imported, "Storybook")).toContain(
      '  framework: reactNativeWeb({\n    nativePackages: [\n      "legacy-chart"\n    ]\n  }),'
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
