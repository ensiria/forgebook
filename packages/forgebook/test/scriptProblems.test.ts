/**
 * Tests for the project's scripts that do not parse: one problem each with its place, kept between processes and read
 * again, renewed by an edit that breaks or fixes one, and named among the catalogue's problems once.
 *
 * @module
 */
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { StorySource } from "@forgebook/story-format/source";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STORY_FILE_READ_EVENT } from "../src/hotModules.ts";
import { storyTree } from "../src/storyTree.ts";
import { storyFileHotHooks } from "../src/vite/hotSnippets.ts";
import { FILES_PREFIX } from "../src/vite/pluginModules.ts";
import { isNamedScript, parsedScript, scriptProblems } from "../src/vite/scriptProblems.ts";
import { storyFilesCode } from "../src/vite/storyFilesModule.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

const BROKEN = 'import { x } from "dep";\nimport "./side.css";\nexport const Broken = ( => x;\n';
const FIXED = 'import { x } from "dep";\nexport const Broken = () => x;\n';

let dir = "";
let file = "";

beforeEach(() => {
  dir = VITE_PATHS.normalize(realpathSync(mkdtempSync(join(tmpdir(), "forgebook-scripts-"))));
  file = `${dir}/Broken.tsx`;
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("parsedScript", () => {
  it("names a script that does not parse with its line and column, and still reads its imports", () => {
    expect(parsedScript("/app/Broken.tsx", BROKEN)).toEqual({
      imports: ["dep", "./side.css"],
      isJsx: false,
      problem: "/app/Broken.tsx:3:25 does not parse: Unexpected token"
    });
    expect(parsedScript("/app/Card.js", "export const a = <p />;\n")).toMatchObject({
      isJsx: true,
      problem: undefined
    });
  });

  it("takes the project's scripts, not story files nor installed packages", () => {
    expect(isNamedScript("/app/src/Broken.tsx")).toBe(true);
    expect(isNamedScript("/app/src/Broken.stories.tsx")).toBe(false);
    expect(isNamedScript("/app/node_modules/x/index.js")).toBe(false);
    expect(isNamedScript("/app/src/styles.css")).toBe(false);
  });
});

describe("scriptProblems", () => {
  it("keeps what a scan found for the next process, which reads each file again", () => {
    writeFileSync(file, BROKEN);
    const scan = scriptProblems();
    scan.start(console, `${dir}/cache`);
    expect(scan.scanned(file, parsedScript(file, BROKEN).problem)).toBe(true);
    // found again by a second scan: nothing new
    expect(scan.scanned(file, parsedScript(file, BROKEN).problem)).toBe(false);
    const server = scriptProblems();
    server.start(console, `${dir}/cache`);
    expect(server.list()).toEqual([`${file}:3:25 does not parse: Unexpected token`]);
    // fixed while no server ran
    writeFileSync(file, FIXED);
    const later = scriptProblems();
    later.start(console, `${dir}/cache`);
    expect(later.list()).toEqual([]);
  });

  it("tells an edit that breaks or fixes a script, and nothing for one that changes neither", () => {
    const problems = scriptProblems();
    writeFileSync(file, BROKEN);
    expect(problems.edited(file)).toEqual({ file, problem: `${file}:3:25 does not parse: Unexpected token` });
    expect(problems.edited(file)).toBeUndefined();
    writeFileSync(file, FIXED);
    expect(problems.edited(file)).toEqual({ file });
    expect(problems.list()).toEqual([]);
    expect(problems.edited(`${dir}/Card.stories.tsx`)).toBeUndefined();
  });
});

describe("a script's edit on a dev server", () => {
  /** An environment that records what it renews and sends. */
  const environment = (name: string): { environment: unknown; invalidated: string[]; sent: unknown[] } => {
    const invalidated: string[] = [];
    const sent: unknown[] = [];
    const ids = [`${FILES_PREFIX}/app|./*.stories.tsx`, "/app/Other.tsx"];
    return {
      environment: {
        name,
        moduleGraph: {
          idToModuleMap: new Map(ids.map((id) => [id, { id }])),
          getModuleById: (id: string): { id: string } => ({ id }),
          invalidateModule: (module: { id: string }): void => void invalidated.push(module.id)
        },
        hot: { send: (payload: unknown): void => void sent.push(payload) }
      },
      invalidated,
      sent
    };
  };

  it("renews every pattern's module in every environment once, and tells the pages", () => {
    const problems = scriptProblems();
    const hooks = storyFileHotHooks(
      () => true,
      { edited: () => ({ changed: [], renewed: [] }), listing: () => [] },
      { follow: () => undefined, isLateReport: () => false },
      problems
    );
    const { hotUpdate } = hooks;
    if (typeof hotUpdate !== "function") throw new Error("missing hook");
    const client = environment("client");
    const ssr = environment("ssr");
    const server = { environments: { client: client.environment, ssr: ssr.environment } };
    writeFileSync(file, BROKEN);
    for (const each of [client, ssr]) {
      hotUpdate.call({ environment: each.environment } as never, { file, type: "update", server } as never);
    }
    expect(client.invalidated).toEqual([`${FILES_PREFIX}/app|./*.stories.tsx`]);
    expect(ssr.invalidated).toEqual([`${FILES_PREFIX}/app|./*.stories.tsx`]);
    expect(client.sent).toEqual([
      {
        type: "custom",
        event: STORY_FILE_READ_EVENT,
        data: { file, problem: `${file}:3:25 does not parse: Unexpected token` }
      }
    ]);
    expect(ssr.sent).toEqual([]);
  });
});

describe("the catalogue's problems", () => {
  it("name a script that does not parse once, though every group's module names it", () => {
    const problem = "/app/Broken.tsx:3:25 does not parse: Unexpected token";
    const code = storyFilesCode(
      "/app",
      ["./*.stories.tsx"],
      [],
      { hasUsage: false, hasReach: false },
      false,
      [],
      [problem]
    );
    expect(code).toContain("problems: [");
    expect(code).toContain("Broken.tsx:3:25 does not parse");
    const group = { index: {}, stories: {}, docs: {}, code: {}, pages: {}, problems: [problem] };
    const source = (id: string): StorySource => ({
      id,
      name: id,
      files: [group, group],
      sheets: { required: [], theme: [], restyled: [] }
    });
    expect(storyTree([source("a"), source("b")]).problems).toEqual([problem]);
  });
});
