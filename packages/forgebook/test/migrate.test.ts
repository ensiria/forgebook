/**
 * Tests for `forgebook migrate`: each codemod on configurations written in the shapes people write them, the text edits
 * they share, the choice of codemods by version, and the command run as a process.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CODEMODS } from "../bin/forgebook/migrate/codemods.ts";
import type { Codemod } from "../bin/forgebook/migrate/migrate.types.ts";
import {
  isMigrationPending,
  isVersionBefore,
  migrateProblem,
  runMigrate
} from "../bin/forgebook/migrate/migrateRun.ts";
import { appliedEdits } from "../bin/forgebook/migrate/objectEdits.ts";
import { playOnInBuilds } from "../bin/forgebook/migrate/playOnInBuilds.ts";
import { propGroupStrings } from "../bin/forgebook/migrate/propGroupStrings.ts";

/** The command's entry. */
const ENTRY = join(import.meta.dirname, "..", "bin", "forgebook", "forgebook.mts");

/**
 * A codemod's result on a text, applied.
 *
 * @param codemod - the codemod.
 * @param text - the file's text.
 * @param path - its name, for its kind of script.
 */
const migrated = (codemod: Codemod, text: string, path = "forgebook.config.ts"): string =>
  appliedEdits(text, codemod.run(text, path).edits);

/** Lines joined, so that a file reads as written. */
const lines = (...each: string[]): string => `${each.join("\n")}\n`;

describe("prop-group-strings", () => {
  it("removes the strings on lines of their own, and keeps the others with their comments", () => {
    const before = lines(
      "export default defineConfig({",
      '  title: "Kit",',
      "  strings: {",
      '    props: "Proprietà",',
      '    "propGroups.choice": "Scelte", // a heading',
      "    // the panel's empty text",
      '    otherProps: "Altre"',
      "  }",
      "});"
    );
    expect(migrated(propGroupStrings, before)).toBe(
      lines(
        "export default defineConfig({",
        '  title: "Kit",',
        "  strings: {",
        '    props: "Proprietà",',
        "    // the panel's empty text",
        '    otherProps: "Altre"',
        "  }",
        "});"
      )
    );
  });

  it("takes the comma off the property left last", () => {
    const before = lines(
      "export default {",
      "  strings: {",
      '    props: "Props",',
      '    "propGroups.text": "Text",',
      '    "propGroups.toggle": "Toggles"',
      "  }",
      "};"
    );
    expect(migrated(propGroupStrings, before)).toBe(
      lines("export default {", "  strings: {", '    props: "Props"', "  }", "};")
    );
  });

  it("keeps a trailing comma the object had", () => {
    const before = lines(
      "export default {",
      "  strings: {",
      '    props: "Props",',
      '    "propGroups.text": "Text",',
      "  },",
      "};"
    );
    expect(migrated(propGroupStrings, before)).toBe(
      lines("export default {", "  strings: {", '    props: "Props",', "  },", "};")
    );
  });

  it("cuts strings out of a line they share, first, middle or last", () => {
    expect(
      migrated(propGroupStrings, 'const a = { strings: { "propGroups.choice": "C", props: "P" } };')
    ).toBe('const a = { strings: { props: "P" } };');
    expect(
      migrated(propGroupStrings, 'const a = { strings: { a: "A", "propGroups.text": "T", b: "B" } };')
    ).toBe('const a = { strings: { a: "A", b: "B" } };');
    expect(
      migrated(propGroupStrings, 'const a = { strings: { props: "P", "propGroups.toggle": "T" } };')
    ).toBe('const a = { strings: { props: "P" } };');
  });

  it("removes a strings left with nothing, in a preset module too", () => {
    const before = 'export const kit = { name: "kit", strings: { "propGroups.choice": "C" }, gridStep: 8 };';
    expect(migrated(propGroupStrings, before, "preset.js")).toBe(
      'export const kit = { name: "kit", gridStep: 8 };'
    );
  });

  it("leaves a file with none of them as it is, and a prop group named in a story", () => {
    const text = 'export default { parameters: { propGroups: ["Texts"] }, strings: { props: "P" } };';
    expect(propGroupStrings.run(text, "Button.stories.ts").edits).toEqual([]);
  });

  it("is idempotent", () => {
    const before = 'export default { strings: { props: "P", "propGroups.choice": "C" } };';
    const once = migrated(propGroupStrings, before);
    expect(propGroupStrings.run(once, "forgebook.config.ts").edits).toEqual([]);
  });
});

describe("play-on-in-builds", () => {
  it("writes play after the title, on its own line", () => {
    const before = lines(
      "export default defineConfig({",
      "  framework: react(),",
      '  title: "Kit",',
      '  stories: ["src/**/*.stories.tsx"]',
      "});"
    );
    expect(migrated(playOnInBuilds, before)).toBe(
      lines(
        "export default defineConfig({",
        "  framework: react(),",
        '  title: "Kit",',
        '  play: "on",',
        '  stories: ["src/**/*.stories.tsx"]',
        "});"
      )
    );
  });

  it("writes play after a title that comes last, with the comma it needs", () => {
    expect(
      migrated(playOnInBuilds, lines("export default {", "  framework: react(),", '  title: "Kit"', "};"))
    ).toBe(lines("export default {", "  framework: react(),", '  title: "Kit",', '  play: "on"', "};"));
  });

  it("follows the configuration through a name, satisfies and an inline object, in its quotes", () => {
    const named =
      "const config = { title: 'Kit', stories: [] } satisfies ForgebookConfig;\nexport default config;\n";
    expect(migrated(playOnInBuilds, named, "forgebook.config.mts")).toBe(
      "const config = { title: 'Kit', play: 'on', stories: [] } satisfies ForgebookConfig;\nexport default config;\n"
    );
    expect(migrated(playOnInBuilds, "export default {};", "forgebook.config.js")).toBe(
      'export default { play: "on" };'
    );
  });

  it("leaves a configuration that says play as it is", () => {
    expect(
      playOnInBuilds.run('export default { title: "Kit", play: "off" };', "forgebook.config.ts")
    ).toEqual({
      edits: [],
      manual: []
    });
  });

  it("leaves to a person a configuration it cannot see into", () => {
    expect(playOnInBuilds.run("export default makeConfig();", "forgebook.config.ts").manual).toHaveLength(1);
    expect(
      playOnInBuilds.run('export default { ...shared, title: "Kit" };', "forgebook.config.ts").manual
    ).toHaveLength(1);
  });

  it("is idempotent", () => {
    const once = migrated(playOnInBuilds, 'export default { title: "Kit" };');
    expect(playOnInBuilds.run(once, "forgebook.config.ts").edits).toEqual([]);
  });
});

describe("the codemods' choice", () => {
  it("compares versions by their numbers", () => {
    expect(isVersionBefore("0.3.3", "0.4.0")).toBe(true);
    expect(isVersionBefore("0.10.0", "0.4.0")).toBe(false);
    expect(isVersionBefore("0.4.0", "0.4.0")).toBe(false);
    expect(isVersionBefore("v0.3.9-beta.1", "0.4.0")).toBe(true);
  });

  it("refuses a version that is not one and a codemod nobody wrote", () => {
    expect(migrateProblem({ from: "latest" })).toContain("is not a version");
    expect(migrateProblem({ only: ["nothing"] })).toContain("No codemod nothing");
    expect(migrateProblem({ from: "0.3.3", only: [CODEMODS[0]?.id ?? ""] })).toBeUndefined();
  });

  it("gives every codemod a version, and every id once", () => {
    const ids = CODEMODS.map((codemod) => codemod.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const codemod of CODEMODS) expect(codemod.breaksIn).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("runMigrate", () => {
  let dir = "";
  const config = (): string => join(dir, "forgebook.config.ts");
  const Old = lines(
    "export default defineConfig({",
    '  title: "Kit",',
    '  strings: { props: "P", "propGroups.choice": "C" }',
    "});"
  );

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "forgebook-migrate-"));
    writeFileSync(config(), Old);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lists without writing, runs rewrites only with no version, and says what it skipped", () => {
    const document = runMigrate({ cwd: dir, config: config(), modules: [], isWrite: false });
    expect(readFileSync(config(), "utf8")).toBe(Old);
    expect(document.changes).toEqual([
      {
        file: "forgebook.config.ts",
        codemod: "prop-group-strings",
        removed: '"propGroups.choice": "C"',
        added: ""
      }
    ]);
    expect(document.skipped.map((each) => each.codemod)).toEqual(["play-on-in-builds"]);
    expect(isMigrationPending(document)).toBe(true);
  });

  it("writes every change since a version, then finds nothing", () => {
    const written = runMigrate({ cwd: dir, config: config(), modules: [], from: "0.3.3", isWrite: true });
    expect(written.isWritten).toBe(true);
    expect(isMigrationPending(written)).toBe(false);
    expect(readFileSync(config(), "utf8")).toBe(
      lines(
        "export default defineConfig({",
        '  title: "Kit",',
        '  play: "on",',
        '  strings: { props: "P" }',
        "});"
      )
    );
    const again = runMigrate({ cwd: dir, config: config(), modules: [], from: "0.3.3", isWrite: true });
    expect(again.changes).toEqual([]);
    expect(isMigrationPending(again)).toBe(false);
  });

  it("reads a file given twice, or the configuration given again, once", () => {
    const preset = join(dir, "preset.ts");
    writeFileSync(preset, 'export const kit = { name: "kit", strings: { "propGroups.toggle": "T" } };\n');
    const document = runMigrate({
      cwd: dir,
      config: config(),
      modules: [preset, preset, config()],
      isWrite: false
    });
    expect(document.files).toEqual(["forgebook.config.ts", "preset.ts"]);
    expect(document.changes.map((change) => change.file)).toEqual(["forgebook.config.ts", "preset.ts"]);
  });

  it("runs nothing and gives no notes for a project past every change", () => {
    const document = runMigrate({ cwd: dir, config: config(), modules: [], from: "0.4.0", isWrite: false });
    expect(document.changes).toEqual([]);
    expect(document.notes).toEqual([]);
    expect(document.skipped).toHaveLength(CODEMODS.length);
  });
});

describe("forgebook migrate", () => {
  let dir = "";
  const run = (...args: string[]): ReturnType<typeof spawnSync> =>
    spawnSync(process.execPath, [ENTRY, "migrate", ...args], { cwd: dir, encoding: "utf8" });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "forgebook-migrate-command-"));
    writeFileSync(
      join(dir, "forgebook.config.ts"),
      'export default { title: "Kit", strings: { "propGroups.text": "T" } };\n'
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("exits 1 with changes to make, 0 once written, and 2 on a version that is not one", () => {
    const listed = run("--from", "0.3.3", "--json");
    expect(listed.status).toBe(1);
    expect(JSON.parse(String(listed.stdout))).toMatchObject({ schema: 1, from: "0.3.3", isWritten: false });
    expect(run("--from", "0.3.3", "--write").status).toBe(0);
    expect(readFileSync(join(dir, "forgebook.config.ts"), "utf8")).toBe(
      'export default { title: "Kit", play: "on" };\n'
    );
    expect(run("--from", "0.3.3").status).toBe(0);
    expect(run("--from", "soon").status).toBe(2);
    expect(run("missing.ts").status).toBe(2);
    // five runs of the whole command, as the other tests of a command as a process allow
  }, 60_000);
});
