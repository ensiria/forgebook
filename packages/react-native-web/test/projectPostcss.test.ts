/**
 * Tests for the project's PostCSS run on its style sheets, and for what its result says it depends on.
 *
 * @module
 */
import { join } from "node:path";

import { build, type Rolldown } from "vite";
import { describe, expect, it } from "vitest";

import { dependenciesOf, projectPostcss } from "../src/vite/projectPostcss.ts";

/**
 * A project's style sheets, built with the plugin.
 *
 * @param root - the project's folder.
 */
const builtCss = async (root: string): Promise<string> => {
  const result = await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [projectPostcss()],
    build: { write: false, rolldownOptions: { input: join(root, "entry.ts") } }
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((each) =>
    "output" in each ? each.output : []
  );
  return outputs
    .filter(
      (output): output is Rolldown.OutputAsset => output.type === "asset" && output.fileName.endsWith(".css")
    )
    .map((output) => String(output.source))
    .join("\n");
};

describe("the project's PostCSS", () => {
  it("runs on a project's style sheets, before Vite compiles them", async () => {
    const css = await builtCss(join(import.meta.dirname, "styled"));
    expect(css).toContain(".marked-by-postcss");
    expect(css).toContain(".app");
  });

  it("does nothing for a project without a configuration", async () => {
    const css = await builtCss(join(import.meta.dirname, "project-css"));
    expect(css).not.toContain("marked-by-postcss");
  });
});

describe("what a PostCSS result depends on", () => {
  it("is the folders and files its messages name, other messages left out", () => {
    expect(
      dependenciesOf([
        { type: "dir-dependency", dir: "/app/src", glob: "**/*.tsx" },
        { type: "dependency", file: "/app/tailwind.config.js" },
        { type: "warning", text: "x" },
        "not a message"
      ])
    ).toEqual({ dirs: [{ dir: "/app/src" }], files: ["/app/tailwind.config.js"] });
  });
});
