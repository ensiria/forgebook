// @vitest-environment node
/**
 * Tests for what the plugins read of a Next.js project: an image's size, `next.config`, the settings the frame's page
 * gets, Sass's options and PostCSS's configuration.
 *
 * @module
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configuredPlugins, postcssConfigFile, watchedFiles } from "forgebook/vite/project-postcss";
import { describe, expect, it } from "vitest";

import { imageSize } from "../src/vite/imageSize.ts";
import { loadNextConfig, nextConfigFile, readNextConfig } from "../src/vite/nextConfig.ts";
import { imageSettings, pageScript, sassPreprocessorOptions } from "../src/vite/nextPlugin.ts";

/** The Next.js fixture app. */
const FIXTURE = join(import.meta.dirname, "..", "..", "..", "fixtures", "nextjs");

/**
 * Bytes from numbers and texts, a text written as its ASCII codes.
 *
 * @param parts - the parts.
 */
const bytes = (...parts: readonly (number | string)[]): Uint8Array =>
  new Uint8Array(
    parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : [part]))
  );

describe("imageSize", () => {
  it("reads the size of each format Next.js imports as an image", () => {
    expect(imageSize(new Uint8Array(readFileSync(join(FIXTURE, "components", "harbour.png"))))).toEqual({
      width: 640,
      height: 320
    });
    expect(imageSize(new Uint8Array(readFileSync(join(FIXTURE, "public", "anchor.svg"))))).toEqual({
      width: 32,
      height: 32
    });
    expect(imageSize(new TextEncoder().encode('<svg viewBox="0 0 120.4 60">'))).toEqual({
      width: 120,
      height: 60
    });
    const gif = bytes("GIF89a", 10, 0, 20, 0, ...new Array(30).fill(0));
    expect(imageSize(gif)).toEqual({ width: 10, height: 20 });
    // a JPEG: start of image, an APP0 segment of 4 bytes, then a start of frame of 17 by 9
    const jpeg = bytes(
      0xff,
      0xd8,
      0xff,
      0xe0,
      0,
      4,
      0,
      0,
      0xff,
      0xc0,
      0,
      17,
      8,
      0,
      9,
      0,
      17,
      ...new Array(20).fill(0)
    );
    expect(imageSize(jpeg)).toEqual({ width: 17, height: 9 });
    const webp = bytes("RIFF", 0, 0, 0, 0, "WEBP", "VP8X", 0, 0, 0, 0, 0, 0, 0, 0, 99, 0, 0, 49, 0, 0, 0, 0);
    expect(imageSize(webp)).toEqual({ width: 100, height: 50 });
    expect(imageSize(bytes("nothing an image starts with, long enough"))).toBeUndefined();
    // a small image is read by its signature, and an SVG with one side takes the other from its viewBox
    expect(imageSize(bytes("GIF89a", 3, 0, 4, 0, ...new Array(16).fill(0)))).toEqual({ width: 3, height: 4 });
    expect(imageSize(new TextEncoder().encode('<svg width="200" viewBox="0 0 100 50">'))).toEqual({
      width: 200,
      height: 100
    });
  });
});

describe("next.config", () => {
  it("reads what a catalogue needs, leaving out a field of the wrong type", () => {
    expect(
      readNextConfig(
        {
          basePath: "/docs/",
          env: { A: "1", B: 2 },
          images: { loaderFile: "./loader.ts" },
          sassOptions: [],
          publicRuntimeConfig: { x: 1 }
        },
        "next.config.js"
      )
    ).toEqual({
      file: "next.config.js",
      basePath: "/docs",
      env: { A: "1" },
      images: { loaderFile: "./loader.ts" },
      sassOptions: {},
      publicRuntimeConfig: { x: 1 }
    });
  });

  it("loads the fixture's next.config.ts, calls a function export with the phase, and names a file that fails", async () => {
    const file = nextConfigFile(FIXTURE, undefined);
    expect(file).toBe(join(FIXTURE, "next.config.ts"));
    expect((await loadNextConfig(file, "phase-development-server")).config.env).toEqual({
      HARBOUR_NAME: "Harbour"
    });
    const dir = mkdtempSync(join(tmpdir(), "forgebook-next-config-"));
    writeFileSync(
      join(dir, "next.config.mjs"),
      "export default (phase) => ({ basePath: phase === 'phase-production-build' ? '/b' : '/d' });\n"
    );
    expect(
      (await loadNextConfig(nextConfigFile(dir, undefined), "phase-production-build")).config.basePath
    ).toBe("/b");
    writeFileSync(join(dir, "broken.mjs"), "export default {;\n");
    const broken = await loadNextConfig(nextConfigFile(dir, "broken.mjs"), "phase-development-server");
    expect(broken.problem).toContain("broken.mjs could not be loaded");
    expect(broken.config.env).toEqual({});
    expect(await loadNextConfig(undefined, "phase-development-server")).toMatchObject({ problem: undefined });
  });
});

describe("the frame's page and the plugins' settings", () => {
  it("draws images as they are unless a loaderFile gives the addresses, from Next.js's own defaults", () => {
    const plain = imageSettings(FIXTURE, {});
    expect(plain).toMatchObject({ unoptimized: true, loader: "default" });
    expect(plain["deviceSizes"]).toContain(640);
    expect(imageSettings(FIXTURE, { loaderFile: "./loader.ts" })).toMatchObject({
      loader: "custom",
      loaderFile: ""
    });
  });

  it("writes the page's variables so that a value cannot close its script", () => {
    const script = pageScript(
      { NEXT_PUBLIC_X: "</script><script>alert(1)</script>" },
      { basePath: "", publicRuntimeConfig: {} }
    );
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c\\u002fscript\\u003e");
    expect(script).toContain('globalThis[Symbol.for("forgebook.nextjs.app")]');
  });

  it("writes Next.js's Sass options as the modern compiler names them", () => {
    expect(
      sassPreprocessorOptions({
        includePaths: ["styles"],
        loadPaths: ["more"],
        prependData: "$x: 1;",
        implementation: "sass",
        quietDeps: true
      })
    ).toEqual({ quietDeps: true, loadPaths: ["styles", "more"], additionalData: "$x: 1;" });
  });
});

describe("PostCSS", () => {
  it("finds the project's configuration and loads its plugins as Next.js names them", async () => {
    expect(postcssConfigFile(FIXTURE)).toBe(join(FIXTURE, "postcss.config.mjs"));
    const made: string[] = [];
    const load = async (name: string): Promise<unknown> => ({
      default: (options?: unknown) => made.push(`${name}:${JSON.stringify(options)}`)
    });
    const object = { name: "ready" };
    await configuredPlugins({ a: {}, b: false, c: true, d: { x: 1 } }, load);
    await configuredPlugins(["e", ["f", { y: 2 }], object], load);
    expect(made).toEqual(["a:{}", "c:undefined", 'd:{"x":1}', "e:undefined", 'f:{"y":2}']);
  });

  it("watches the files a plugin read", () => {
    expect(
      watchedFiles([
        { type: "dependency", file: "/a.css" },
        { type: "dir-dependency", dir: join(FIXTURE, "components"), glob: "*.module.css" },
        { type: "warning" }
      ])
    ).toEqual(["/a.css", join(FIXTURE, "components", "Hero.module.css")]);
  });
});
