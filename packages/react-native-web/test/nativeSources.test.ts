/**
 * Tests for what a React Native project's code needs before the browser runs it: which files are compiled, the
 * packages written for React Native, the web's extensions, the globals and Flow's types.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  isNativePackage,
  isNativeSource,
  NATIVE_SCRIPT,
  nativeDefines,
  nativePackagePattern,
  packageOf,
  WEB_EXTENSIONS,
  withoutFlow
} from "../src/vite/nativeSources.ts";

describe("the package a file belongs to", () => {
  it("is the name after the last node_modules, scoped or not, in npm's layout and in pnpm's", () => {
    expect(packageOf("/app/node_modules/expo-font/build/index.js")).toBe("expo-font");
    expect(packageOf("/app/node_modules/@expo/vector-icons/build/Ionicons.js")).toBe("@expo/vector-icons");
    expect(
      packageOf("/app/node_modules/.pnpm/expo-font@58.0.11_x/node_modules/expo-font/build/FontHooks.js")
    ).toBe("expo-font");
    expect(packageOf("C:\\app\\node_modules\\react-native-svg\\lib\\index.js")).toBe("react-native-svg");
  });

  it("is none for a file of the project's own", () => {
    expect(packageOf("/app/src/legacy/WindBadge.js")).toBeUndefined();
  });
});

describe("the packages written for React Native", () => {
  it("are React Native's and Expo's families, by a whole part of their name", () => {
    for (const name of [
      "react-native-svg",
      "@react-native/assets-registry",
      "expo",
      "expo-font",
      "@expo/vector-icons"
    ])
      expect(isNativePackage(name, [])).toBe(true);
    for (const name of [
      "exponent",
      "expose",
      "react",
      "react-dom",
      "react-nativeish",
      "@react-navigation/native"
    ])
      expect(isNativePackage(name, [])).toBe(false);
  });

  it("leave out react-native itself, never loaded, and react-native-web, which ships plain JavaScript", () => {
    expect(isNativePackage("react-native", [])).toBe(false);
    expect(isNativePackage("react-native-web", [])).toBe(false);
    expect(isNativePackage("react-native-web/dist/cjs/index.js", [])).toBe(false);
  });

  it("take the packages the catalogue names, exactly, with the modules inside them", () => {
    const pattern = nativePackagePattern(["@shopify/flash-list", "victory.native"]);
    expect(pattern.test("@shopify/flash-list")).toBe(true);
    expect(pattern.test("@shopify/flash-list/dist/index.js")).toBe(true);
    expect(pattern.test("@shopify/flash-listy")).toBe(false);
    // a dot in a name is a dot, not any character
    expect(pattern.test("victoryxnative")).toBe(false);
    expect(pattern.test("@expo/vector-icons/Ionicons")).toBe(true);
  });
});

describe("the files compiled as React Native's", () => {
  it("are the project's own and those of the packages written for React Native", () => {
    expect(isNativeSource("/app/src/WindBadge.js", [])).toBe(true);
    expect(isNativeSource("/app/node_modules/@expo/vector-icons/build/createIconSet.js", [])).toBe(true);
    expect(isNativeSource("/app/node_modules/lodash/lodash.js", [])).toBe(false);
    expect(isNativeSource("/app/node_modules/react-native-web/dist/index.js", [])).toBe(false);
    expect(isNativeSource("/app/node_modules/legacy-chart/index.js", ["legacy-chart"])).toBe(true);
  });

  it("are the scripts a web bundler reads as plain JavaScript, with or without a query", () => {
    expect(NATIVE_SCRIPT.test("/app/src/WindBadge.js")).toBe(true);
    expect(NATIVE_SCRIPT.test("/app/node_modules/x/index.mjs?v=12ab")).toBe(true);
    expect(NATIVE_SCRIPT.test("/app/src/Card.tsx")).toBe(false);
    expect(NATIVE_SCRIPT.test("/app/src/data.json")).toBe(false);
  });
});

describe("the web's extensions", () => {
  it("put every .web variant before the plain files, and never read .native or .ios files", () => {
    const firstPlain = WEB_EXTENSIONS.indexOf(".tsx");
    expect(WEB_EXTENSIONS.slice(0, firstPlain).every((extension) => extension.startsWith(".web."))).toBe(
      true
    );
    expect(WEB_EXTENSIONS).toContain(".web.jsx");
    expect(WEB_EXTENSIONS.some((extension) => /native|ios|android/.test(extension))).toBe(false);
  });
});

describe("React Native's globals", () => {
  it("say whether the catalogue runs in development, the web as Expo's platform, and global as globalThis", () => {
    const defines = nativeDefines(true);
    expect(defines["__DEV__"]).toBe("true");
    expect(defines["process.env.EXPO_OS"]).toBe('"web"');
    expect(defines["global"]).toBe("globalThis");
    expect(Object.keys(defines)).toHaveLength(3);
    expect(nativeDefines(false)["__DEV__"]).toBe("false");
  });
});

describe("Flow's types", () => {
  it("are blanked out in a file with a Flow pragma, every other character in its place", async () => {
    const code = [
      "/** @flow */",
      'export type Unit = "kn" | "km/h";',
      'export const speed = (knots: number, unit: Unit): string => knots + " " + unit;'
    ].join("\n");
    const stripped = await withoutFlow(code);
    expect(stripped).not.toContain(": number");
    expect(stripped).not.toContain("export type");
    expect(stripped.split("\n")).toHaveLength(3);
    expect(stripped.split("\n").map((line) => line.length)).toEqual(
      code.split("\n").map((line) => line.length)
    );
    expect(stripped).toContain("export const speed = (knots");
  });

  it("are left alone in a file without a pragma, which is returned as it is", async () => {
    const code = "export const a = (b) => b;";
    expect(await withoutFlow(code)).toBe(code);
  });
});
