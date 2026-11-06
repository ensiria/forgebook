/**
 * Tests for what agents read: the section stays short whatever the framework, holds only that framework's words, and
 * everything else is reachable by name; and the framework is told from the project.
 *
 * @module
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  agentsSection,
  GUIDE_FRAMEWORKS,
  GUIDE_TOPICS,
  guideList,
  guideTool,
  guideTopic,
  projectFrameworks
} from "../bin/forgebook/agentGuide.ts";

/** The most a project's section may weigh, in bytes: long instructions lose their middle. */
const SECTION_BUDGET = 3000;

/** The packages of the repository. */
const PACKAGES = join(import.meta.dirname, "..", "..");

const root = mkdtempSync(join(tmpdir(), "forgebook-guide-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A project folder holding these files. */
const project = (name: string, files: Readonly<Record<string, string>>): string => {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
};

describe("agentsSection", () => {
  it.each([[[]], ...GUIDE_FRAMEWORKS.map((framework) => [[framework]])])(
    "stays under its budget for %j",
    (frameworks: readonly string[]) => {
      expect(Buffer.byteLength(agentsSection(frameworks))).toBeLessThan(SECTION_BUDGET);
    }
  );

  it("holds the loop and how to look things up, whatever the framework", () => {
    for (const framework of GUIDE_FRAMEWORKS) {
      const section = agentsSection([framework]);
      expect(section).toContain("npx forgebook verify --json");
      expect(section).toContain("npx forgebook check-code --json");
      expect(section).toContain(`npx forgebook guide ${framework}`);
      expect(section).toContain("get_guide");
      expect(section).not.toContain("<!-- more -->");
    }
  });

  it("says a component gets its stories whether or not verify asks for them", () => {
    expect(agentsSection([])).toContain("whether or not a check asks for them");
  });

  it("holds its own framework's words only", () => {
    for (const framework of GUIDE_FRAMEWORKS) {
      const section = agentsSection([framework]);
      for (const other of GUIDE_FRAMEWORKS.filter((each) => each !== framework)) {
        expect(section).not.toContain(`@forgebook/${other}"`);
        expect(section).not.toContain(`@forgebook/${other}\``);
      }
      expect(section).toContain(`"@forgebook/${framework}"`);
    }
  });

  it("names every topic, so an agent can ask for it", () => {
    for (const topic of Object.keys(GUIDE_TOPICS)) expect(agentsSection([])).toContain(`\`${topic}\``);
  });

  it("stays under its budget with every framework at once, naming them instead", () => {
    const section = agentsSection(GUIDE_FRAMEWORKS);
    expect(Buffer.byteLength(section)).toBeLessThan(SECTION_BUDGET);
    for (const framework of GUIDE_FRAMEWORKS) expect(section).toContain(`\`${framework}\``);
    expect(section).not.toContain("satisfies Meta");
  });

  it("points a project with no framework found to the list", () => {
    expect(agentsSection([])).toContain("npx forgebook guide <framework>");
    expect(agentsSection([])).not.toContain("{{framework}}");
  });
});

describe("the guide", () => {
  it("has a framework for every adapter the repository publishes", () => {
    const adapters = readdirSync(PACKAGES).filter((name) => {
      const manifest = readFileSync(join(PACKAGES, name, "package.json"), "utf8");
      // `testing` has a Vite entry of its own, for the tests it generates: it writes no stories
      return name !== "forgebook" && name !== "testing" && manifest.includes('"./vite":');
    });
    expect([...GUIDE_FRAMEWORKS].sort()).toEqual(adapters.sort());
  });

  it("prints every topic, without the essentials' marker", () => {
    for (const { topic } of guideList([]).topics) {
      const document = guideTopic(topic);
      expect(document?.text.length).toBeGreaterThan(0);
      expect(document?.text).not.toContain("<!-- more -->");
    }
  });

  it("prints everything at once under `all`", () => {
    const text = guideTopic("all")?.text ?? "";
    expect(text).toContain("# Docs pages");
    for (const framework of GUIDE_FRAMEWORKS) expect(text).toContain(`@forgebook/${framework}`);
  });

  it("answers no topic for a name it does not have, inherited ones included", () => {
    expect(guideTopic("nope")).toBeUndefined();
    expect(guideTopic("constructor")).toBeUndefined();
  });

  it("lists each command once", () => {
    const rows = (guideTopic("commands")?.text ?? "")
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .map((line) => line.split(" | ")[0]);
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows).size).toBe(rows.length);
  });
});

describe("projectFrameworks", () => {
  it("reads the adapters of the manifest when there is no configuration", () => {
    const dir = project("manifest", {
      "package.json": JSON.stringify({ devDependencies: { "@forgebook/vue": "1.0.0" } }, undefined, 2)
    });
    expect(projectFrameworks(undefined, dir)).toEqual(["vue"]);
  });

  it("is not fooled by another package's name, or a word in a description", () => {
    const dir = project("similar", {
      "package.json": JSON.stringify(
        { description: "@forgebook/vue", dependencies: { "@forgebook/react-native-web": "1.0.0" } },
        undefined,
        2
      )
    });
    expect(projectFrameworks(undefined, dir)).toEqual(["react-native-web"]);
  });

  it("reads only the dependency fields: an override is no dependency", () => {
    const dir = project("overrides", {
      "package.json": JSON.stringify({
        pnpm: { overrides: { "@forgebook/react": "1.0.0" } },
        devDependencies: { "@forgebook/solid": "1.0.0" }
      })
    });
    expect(projectFrameworks(undefined, dir)).toEqual(["solid"]);
  });

  it("takes the adapter over the framework it is built on", () => {
    const dir = project("next", {
      "package.json": JSON.stringify({
        dependencies: { "@forgebook/react": "1.0.0", "@forgebook/nextjs": "1.0.0" }
      })
    });
    expect(projectFrameworks(undefined, dir)).toEqual(["nextjs"]);
  });

  it("finds none in a manifest that cannot be read", () => {
    expect(projectFrameworks(undefined, project("torn", { "package.json": "{ not json" }))).toEqual([]);
  });

  it("prefers the adapter the configuration imports, and never runs it", () => {
    const marker = join(root, "ran");
    const dir = project("configured", {
      "forgebook.config.ts": [
        'import { writeFileSync } from "node:fs";',
        'import { nuxt } from "@forgebook/nuxt/vite";',
        `writeFileSync(${JSON.stringify(marker)}, "ran");`,
        "export default { framework: nuxt() };",
        ""
      ].join("\n"),
      "package.json": JSON.stringify({ dependencies: { "@forgebook/vue": "1.0.0" } }, undefined, 2)
    });
    expect(projectFrameworks(join(dir, "forgebook.config.ts"), dir)).toEqual(["nuxt"]);
    expect(existsSync(marker)).toBe(false);
  });

  it("falls back on the manifest beside a configuration that names no adapter", () => {
    const dir = project("custom", {
      "forgebook.config.ts": 'export { default } from "./shared";\n',
      "package.json": JSON.stringify({ dependencies: { "@forgebook/svelte": "1.0.0" } }, undefined, 2)
    });
    expect(projectFrameworks(join(dir, "forgebook.config.ts"), dir)).toEqual(["svelte"]);
  });

  it("finds none in a folder with neither", () => {
    expect(projectFrameworks(undefined, project("empty", {}))).toEqual([]);
  });
});

describe("get_guide", () => {
  const tool = guideTool(["vue"]);

  it("answers the list with no topic, with the catalogue's framework", async () => {
    const result = await tool.call({});
    expect(result.isError).toBe(false);
    expect(result.structured).toMatchObject({ schema: 1, frameworks: ["vue"] });
  });

  it("answers a topic's text", async () => {
    const result = await tool.call({ topic: "vue" });
    expect(result.isError).toBe(false);
    expect(result.structured).toMatchObject({
      topic: "vue",
      text: expect.stringContaining("@forgebook/vue")
    });
  });

  it("fails on a topic it does not have, with the list", async () => {
    const result = await tool.call({ topic: "nope" });
    expect(result.isError).toBe(true);
    expect(result.structured).toMatchObject({ error: expect.stringContaining("No topic nope") });
  });
});
