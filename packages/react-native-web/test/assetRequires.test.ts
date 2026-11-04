/**
 * Tests for React Native's `require` of an asset written as an import of its address.
 *
 * @module
 */
import { codeLiteral } from "forgebook/code-literal";
import { parseAst } from "vite";
import { describe, expect, it } from "vitest";

import { importedAssets } from "../src/vite/assetRequires.ts";

/**
 * The rewrite of a module, parsed as the plugin parses it.
 *
 * @param code - the module's code.
 */
const rewrite = (code: string): string | undefined => importedAssets(code, parseAst(code));

describe("a require of an asset", () => {
  it("becomes the asset's default import, each asset imported once, the code keeping its lines and columns", () => {
    const code = [
      'import { Image } from "react-native-web";',
      'const logo = require("./logo.png");',
      'const fonts = { Mono: require("./fonts/Mono.ttf"), Again: require("./logo.png") };',
      "export { logo, fonts };"
    ].join("\n");
    const rewritten = rewrite(code);
    if (rewritten === undefined) throw new Error("nothing was rewritten");
    const lines = rewritten.split("\n");
    expect(lines.slice(0, 4).map((line) => line.length)).toEqual(code.split("\n").map((line) => line.length));
    expect(lines[1]).toMatch(/^const logo = __fbAsset0 +;$/);
    expect(lines[2]).toMatch(/Mono: __fbAsset1 +, Again: __fbAsset0 +\}/);
    expect(lines.slice(4).filter((line) => line !== "")).toEqual([
      `import __fbAsset0 from ${codeLiteral("./logo.png")};`,
      `import __fbAsset1 from ${codeLiteral("./fonts/Mono.ttf")};`
    ]);
  });

  it("keeps a call written over several lines on as many lines, and takes a name the module does not use", () => {
    const code = [
      'import { Image } from "react-native-web";',
      "const __fbAsset0 = 1;",
      "const logo = require(",
      '  "./logo.png"',
      ");",
      "export { logo, __fbAsset0 };"
    ].join("\n");
    const rewritten = rewrite(code);
    if (rewritten === undefined) throw new Error("nothing was rewritten");
    const lines = rewritten.split("\n");
    expect(lines[5]).toBe(code.split("\n")[5]);
    expect(lines[2]).toMatch(/^const logo = ___fbAsset0/);
    expect(rewritten).toContain(`import ___fbAsset0 from ${codeLiteral("./logo.png")};`);
    // the rewritten module still parses: no name declared twice
    expect(() => parseAst(rewritten)).not.toThrow();
  });

  it("is left alone in a CommonJS module, where an import would change what the module is", () => {
    expect(rewrite('module.exports = { logo: require("./logo.png") };')).toBeUndefined();
  });

  it("is told from a require of a module, of a name built at run time, or of a function named otherwise", () => {
    expect(
      rewrite(
        [
          'import a from "a";',
          'const b = require("./b");',
          'const c = require("./" + a + ".png");',
          'const d = load("./d.png");',
          'const e = require("./e.png", 2);'
        ].join("\n")
      )
    ).toBeUndefined();
  });
});
