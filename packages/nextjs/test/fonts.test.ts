// @vitest-environment node
/**
 * Tests for `next/font` in a catalogue: the calls found and replaced, the Google style sheet's address checked as
 * Next.js checks it, and the module each call becomes, a local font's and a Google font's, downloaded or not.
 *
 * @module
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { codeLiteral } from "forgebook/code-literal";
import { describe, expect, it } from "vitest";

import { findFontCalls, replaceFontCalls } from "../src/vite/fonts/fontCalls.ts";
import { buildFontModule, type FontModuleContext } from "../src/vite/fonts/fontModule.ts";
import { googleFamily, googleFontRequest } from "../src/vite/fonts/googleFonts.ts";

/** A module as a Next.js app writes its fonts. */
const MODULE = [
  'import { Inter, Roboto_Mono as Mono } from "next/font/google";',
  'import localFont from "next/font/local";',
  "",
  'export const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });',
  "export const mono = Mono({",
  '  weight: ["400", "700"],',
  "  subsets: [`latin`],",
  "});",
  'export const brand = localFont({ src: "./brand.woff2", weight: "600" });',
  "export const wrong = Inter({ subsets: names });"
].join("\n");

/** Next.js's data for the families the tests use, as its list writes them. */
const DATA = {
  Inter: {
    weights: ["100", "400", "900", "variable"],
    styles: ["normal", "italic"],
    axes: [
      { tag: "opsz", min: 14, max: 32, defaultValue: 14 },
      { tag: "wght", min: 100, max: 900, defaultValue: 400 }
    ]
  },
  "Roboto Mono": { weights: ["400", "700"], styles: ["normal", "italic"] }
};

describe("findFontCalls and replaceFontCalls", () => {
  it("finds each call with its literal options, names what is not literal, and keeps the lines", () => {
    const found = findFontCalls(MODULE, "/app/fonts.ts");
    expect(found.calls.map((call) => [call.loader, call.family, call.variable, call.options])).toEqual([
      ["google", "Inter", "inter", { subsets: ["latin"], variable: "--font-sans" }],
      ["google", "Roboto Mono", "mono", { weight: ["400", "700"], subsets: ["latin"] }],
      ["local", undefined, "brand", { src: "./brand.woff2", weight: "600" }]
    ]);
    expect(found.problems).toEqual([
      "Inter(…): its options must be written as literals, as Next.js requires"
    ]);
    const replaced = replaceFontCalls(MODULE, found, ["virtual:f/a", "virtual:f/b", "virtual:f/c"]);
    expect(replaced.split("\n")).toHaveLength(MODULE.split("\n").length);
    expect(replaced).toContain(`import __forgebookFont0 from ${codeLiteral("virtual:f/a")};`);
    expect(replaced).toContain("export const mono = __forgebookFont1\n\n\n;");
    expect(replaced).not.toContain("next/font");
    expect(findFontCalls("export const x = 1;", "/a.ts")).toEqual({ calls: [], imports: [], problems: [] });
  });
});

describe("googleFontRequest", () => {
  it("asks for a variable font's range, and the weights and styles given, as Next.js's address writes them", () => {
    const inter = googleFamily(DATA, "Inter");
    const mono = googleFamily(DATA, "Roboto Mono");
    if (inter === undefined || mono === undefined) throw new Error("no data");
    expect(googleFontRequest("Inter", {}, inter)).toEqual({
      url: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
      weights: ["variable"],
      styles: ["normal"]
    });
    const withAxes = googleFontRequest("Inter", { axes: ["opsz"], style: ["normal", "italic"] }, inter);
    expect(typeof withAxes === "string" ? withAxes : withAxes.url).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    );
    const fixed = googleFontRequest("Roboto Mono", { weight: ["700", "400"], display: "block" }, mono);
    expect(typeof fixed === "string" ? fixed : fixed.url).toBe(
      "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=block"
    );
    expect(googleFontRequest("Roboto Mono", {}, mono)).toContain("give a weight");
    expect(googleFontRequest("Roboto Mono", { weight: "300" }, mono)).toContain("no weight 300");
    expect(googleFontRequest("Inter", { display: "slow" }, inter)).toContain("no display slow");
    expect(googleFamily(DATA, "Nope")).toBeUndefined();
  });
});

/**
 * A context for the font modules, writing to a new folder.
 *
 * @param overrides - what the test changes.
 */
const context = (
  overrides: Partial<FontModuleContext> = {}
): FontModuleContext & { readonly warnings: string[] } => {
  const warnings: string[] = [];
  return {
    cacheDir: mkdtempSync(join(tmpdir(), "forgebook-next-font-")),
    googleData: DATA,
    googleFonts: "download",
    fetcher: () => Promise.reject(new Error("offline")),
    warn: (message: string) => warnings.push(message),
    warnings,
    ...overrides
  };
};

/**
 * The style sheet a font's module imports: the path its import's literal names.
 *
 * @param code - the module's code.
 */
const sheetOf = (code: string): string => String(JSON.parse(/import ("[^"]+")/.exec(code)?.[1] ?? '""'));

describe("buildFontModule", () => {
  it("writes a local font's faces, with its file from the style sheet's folder, and its classes", async () => {
    const project = mkdtempSync(join(tmpdir(), "forgebook-next-app-"));
    writeFileSync(join(project, "brand.woff2"), "font");
    const built = await buildFontModule(
      {
        loader: "local",
        family: undefined,
        variable: "brand",
        options: { src: "./brand.woff2", weight: "600", variable: "--font-brand" },
        start: 0,
        end: 0
      },
      join(project, "fonts.ts"),
      context()
    );
    const sheet = sheetOf(built.code);
    const css = readFileSync(sheet, "utf8");
    expect(css).toMatch(
      /font-family: '__brand_\w+';\n {2}src: url\("[^"]*brand\.woff2"\) format\("woff2"\);/
    );
    expect(css).toMatch(/\.__variable_\w+ \{\n {2}--font-brand: '__brand_\w+';/);
    expect(built.code).toMatch(/"style":\{"fontFamily":"'__brand_\w+'","fontWeight":600\}/);
    expect(built.watch).toEqual([join(project, "brand.woff2")]);
  });

  it("downloads a Google font's files beside its style sheet, and serves them from there", async () => {
    const asked: string[] = [];
    const fetched = context({
      fetcher: async (url: string): Promise<Response> => {
        asked.push(url);
        if (new URL(url).host === "fonts.googleapis.com")
          return new Response(
            "@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/s/inter/v1/a.woff2) format('woff2'); }"
          );
        return new Response(new Uint8Array([1, 2, 3]));
      }
    });
    const call = {
      loader: "google" as const,
      family: "Inter",
      variable: "inter",
      options: { fallback: ["system-ui"] },
      start: 0,
      end: 0
    };
    const built = await buildFontModule(call, "/app/fonts.ts", fetched);
    const css = readFileSync(sheetOf(built.code), "utf8");
    expect(css).toMatch(/src: url\("\.\/google-\w+\.woff2"\)/);
    expect(built.code).toContain(`"fontFamily":"'Inter', system-ui"`);
    // the second time, the style sheet comes from the cache: nothing is fetched
    await buildFontModule(call, "/app/fonts.ts", fetched);
    expect(asked).toHaveLength(2);
  });

  it("leaves out an option Next.js would refuse, and keeps the same call in two folders apart", async () => {
    const checked = context({ googleFonts: "none" });
    const built = await buildFontModule(
      {
        loader: "google",
        family: "Inter",
        variable: "inter",
        options: { variable: "--x}body{display:none", fallback: ["serif"] },
        start: 0,
        end: 0
      },
      "/app/fonts.ts",
      checked
    );
    expect(built.code).not.toContain("variable");
    expect(readFileSync(sheetOf(built.code), "utf8")).not.toContain("display:none");
    expect(checked.warnings[0]).toContain("is not a value Next.js accepts");
    const local = context();
    const first = mkdtempSync(join(tmpdir(), "forgebook-next-a-"));
    const second = mkdtempSync(join(tmpdir(), "forgebook-next-b-"));
    writeFileSync(join(first, "f.woff2"), "a");
    writeFileSync(join(second, "f.woff2"), "b");
    const call = {
      loader: "local" as const,
      family: undefined,
      variable: "brand",
      options: { src: "./f.woff2" },
      start: 0,
      end: 0
    };
    const [one, two] = await Promise.all([
      buildFontModule(call, join(first, "fonts.ts"), local),
      buildFontModule(call, join(second, "fonts.ts"), local)
    ]);
    expect(one.code).not.toBe(two.code);
  });

  it("gives the classes with the fallback when Google is out of reach, not asked, or the call is wrong", async () => {
    const call = {
      loader: "google" as const,
      family: "Inter",
      variable: undefined,
      options: {},
      start: 0,
      end: 0
    };
    const offline = context();
    const built = await buildFontModule(call, "/app/fonts.ts", offline);
    expect(built.code).toContain("__className_");
    expect(offline.warnings[0]).toContain("Inter could not be had from Google Fonts");
    const none = context({ googleFonts: "none" });
    await buildFontModule(call, "/app/fonts.ts", none);
    expect(none.warnings).toEqual([]);
    const unknown = context();
    await buildFontModule({ ...call, family: "Nope" }, "/app/fonts.ts", unknown);
    expect(unknown.warnings).toEqual(["Nope is not in Next.js's list of Google fonts"]);
  });
});
