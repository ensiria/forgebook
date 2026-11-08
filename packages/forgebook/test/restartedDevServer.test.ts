/**
 * Tests for a dev server whose clients come before any module of the project was read in its life: a page left open
 * across a restart, a tool, an agent. A group the configuration's sources name answers them; any other stays missing.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, type Plugin, type ViteDevServer } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { resolvedAppBuild } from "../src/vite/appBuildOption.ts";
import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { devServerAccess } from "../src/vite/fileAccess.ts";
import { forgebookPlugin } from "../src/vite/forgebookPlugin.ts";
import { resolvedFrames } from "../src/vite/framesConfig.ts";
import { namesGroup, namingGroupOf } from "../src/vite/pluginIds.ts";
import { storyFilesGroupText } from "../src/vite/storyFilesModule.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";
import { ask, fsAddress, listenOnFreePort, OWN_SCRIPT, portOf, TOOL_SCRIPT } from "./fixtures/rawRequest.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** What every file a client must not read holds. */
const SECRET = "TOP-SECRET";

/** The project's own story patterns. */
const OWN_STORIES = ["src/*.stories.tsx"];

/** The project's own docs patterns. */
const OWN_DOCS = ["docs/*.md"];

/** The address of a group's module. */
const groupAddress = (kind: string, folder: string, patterns: readonly string[]): string =>
  `/@id/__x00__virtual:forgebook-${kind}:${storyFilesGroupText(folder, patterns)}`;

describe("a dev server's first clients", () => {
  let base = "";
  let project = "";
  let outside = "";
  let server: ViteDevServer | undefined;

  /** The catalogue's configuration: its own stories and docs, and a source that names its group through a barrel. */
  const catalogueConfig = (): ResolvedConfig => ({
    title: "Restarted",
    logo: undefined,
    heights: undefined,
    dir: project,
    framework: STUB_FRAMEWORK,
    stories: OWN_STORIES,
    docs: OWN_DOCS,
    sources: ["./barrel.ts"],
    switches: undefined,
    languages: [],
    previews: [],
    head: "",
    shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
    tokens: [],
    argControls: {},
    watch: [],
    lists: { usedIn: false, componentDocs: false },
    plugins: [],
    home: undefined,
    hasPlayTools: false,
    frames: resolvedFrames("same-origin"),
    build: { readableNames: false },
    refs: [],
    appBuild: resolvedAppBuild(false)
  });

  /** Starts a server over the project, with the disk's caches of the one before it. */
  const startWith = async (
    plugins: readonly Plugin[],
    fs: { readonly strict?: boolean } = {}
  ): Promise<number> => {
    await server?.close();
    server = await createServer({
      root: project,
      configFile: false,
      // no person waits for a page: a docs worker still loading when the server closes would abort the process
      mode: "test",
      logLevel: "silent",
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: "127.0.0.1", port: 0, watch: null, fs: { allow: [project], ...fs } },
      plugins: [...plugins]
    });
    await listenOnFreePort(server);
    return portOf(server);
  };

  /** Starts a server over the project with one plugin. */
  const start = (plugin: Plugin): Promise<number> => startWith([plugin]);

  beforeAll(() => {
    base = VITE_PATHS.normalize(realpathSync.native(mkdtempSync(join(tmpdir(), "forgebook-restart-"))));
    project = `${base}/project`;
    outside = `${base}/outside`;
    for (const folder of ["src", "docs", "lib", "deep"])
      mkdirSync(join(project, folder), { recursive: true });
    mkdirSync(outside);
    writeFileSync(join(project, "src", "own.stories.tsx"), "export default {}; export const One = {};\n");
    writeFileSync(join(project, "deep", "deep.stories.tsx"), "export default {}; export const Two = {};\n");
    writeFileSync(join(project, "docs", "page.md"), "# Page\n\nA page.\n");
    writeFileSync(join(project, "barrel.ts"), 'export { source } from "./lib/group.ts";\n');
    writeFileSync(
      join(project, "lib", "group.ts"),
      'import files from "../deep/*.stories.tsx?forgebook-files";\nexport const source = { id: "deep", name: "Deep", files: [files] };\n'
    );
    writeFileSync(
      join(project, "unread.ts"),
      'import files from "./src/*?forgebook-files";\nexport default files;\n'
    );
    writeFileSync(join(outside, "id_rsa"), `${SECRET}\n`);
    writeFileSync(join(outside, "x.stories.tsx"), `export default {}; // ${SECRET}\n`);
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  afterAll(() => {
    rmSync(base, { recursive: true, force: true });
  });

  describe("with a configuration", () => {
    /** The addresses a page holds, in a tab left open: each a group the configuration's sources name. */
    const pageGroups = (): readonly (readonly [string, string])[] => [
      [groupAddress("files", project, OWN_STORIES), "own.stories.tsx"],
      [groupAddress("docs-pages", project, OWN_DOCS), "page.md"],
      [groupAddress("files", `${project}/lib`, ["../deep/*.stories.tsx"]), "deep.stories.tsx"],
      [groupAddress("search", project, OWN_STORIES), "components"],
      [groupAddress("search-pages", project, OWN_DOCS), "A page"]
    ];

    it.each([0, 1, 2, 3, 4])("answers a group an open page asks for first (%i)", async (at) => {
      const port = await start(forgebookPlugin({ config: catalogueConfig() }));
      const asked = pageGroups()[at];
      if (asked === undefined) throw new Error("No such group");
      const answer = await ask(port, asked[0], OWN_SCRIPT);
      expect(answer.status).toBe(200);
      expect(answer.body).not.toContain("export default null");
      expect(answer.body).toContain(asked[1]);
    });

    it("answers several at once, as two tabs ask, with nothing waiting on itself", async () => {
      const port = await start(forgebookPlugin({ config: catalogueConfig() }));
      const answers = await Promise.all(pageGroups().map(([address]) => ask(port, address, OWN_SCRIPT)));
      expect(answers.map(({ status }) => status)).toEqual(answers.map(() => 200));
    });

    it("answers it again after a restart that keeps the disk's caches", async () => {
      const plugin = (): Plugin => forgebookPlugin({ config: catalogueConfig() });
      const [address, listed] = pageGroups()[0] ?? ["", ""];
      expect((await ask(await start(plugin()), address, OWN_SCRIPT)).body).toContain(listed);
      const answer = await ask(await start(plugin()), address, OWN_SCRIPT);
      expect(answer.status).toBe(200);
      expect(answer.body).toContain(listed);
    });

    it("lists a story file added after a first request that came before any module", async () => {
      const port = await start(forgebookPlugin({ config: catalogueConfig() }));
      const [address] = pageGroups()[0] ?? [""];
      await ask(port, address, OWN_SCRIPT);
      const added = join(project, "src", "added.stories.tsx");
      writeFileSync(added, "export default {}; export const Three = {};\n");
      try {
        server?.watcher.emit("add", VITE_PATHS.normalize(added));
        expect((await ask(port, address, OWN_SCRIPT)).body).toContain("added.stories.tsx");
      } finally {
        rmSync(added);
      }
    });

    it("answers a tool's question first, and a group after it", async () => {
      const port = await start(forgebookPlugin({ config: catalogueConfig() }));
      const stories = await ask(port, "/__forgebook/api/stories");
      expect(stories.status).toBe(200);
      expect(stories.body).toContain("One");
      const [address] = pageGroups()[0] ?? [""];
      expect((await ask(port, address, OWN_SCRIPT)).status).toBe(200);
    });

    it("answers a group a broken source names once the source is fixed", async () => {
      const group = join(project, "lib", "group.ts");
      const fixed = readFileSync(group, "utf8");
      writeFileSync(group, "import from from from;\n");
      try {
        const port = await start(forgebookPlugin({ config: catalogueConfig() }));
        const [address] = pageGroups()[2] ?? [""];
        expect((await ask(port, address, OWN_SCRIPT)).status).toBe(404);
        writeFileSync(group, fixed);
        const module = server?.moduleGraph.getModulesByFile(VITE_PATHS.normalize(group));
        for (const stale of module ?? []) server?.moduleGraph.invalidateModule(stale);
        expect((await ask(port, address, OWN_SCRIPT)).status).toBe(200);
      } finally {
        writeFileSync(group, fixed);
      }
    });

    it("answers a group while a source's plugin waits for the server to go idle", async () => {
      const idle: Plugin = {
        name: "waits-for-idle",
        async transform(_code: string, id: string): Promise<null> {
          if (id.endsWith("barrel.ts") && "waitForRequestsIdle" in this.environment)
            await this.environment.waitForRequestsIdle(id);
          return null;
        }
      };
      const port = await startWith([forgebookPlugin({ config: catalogueConfig() }), idle]);
      const [address] = pageGroups()[0] ?? [""];
      expect((await ask(port, address, OWN_SCRIPT)).status).toBe(200);
      const unnamed = await ask(port, groupAddress("files", outside, ["*"]), TOOL_SCRIPT);
      expect(unnamed.status).toBe(404);
    });

    it("answers 404 with server.fs.strict off, reading no group as a file", async () => {
      const port = await startWith([forgebookPlugin({ config: catalogueConfig() })], { strict: false });
      const answer = await ask(port, groupAddress("files", outside, ["*"]), TOOL_SCRIPT);
      expect(answer.status).toBe(404);
    });

    it("keeps every other group missing once it read what the configuration names", async () => {
      const port = await start(forgebookPlugin({ config: catalogueConfig() }));
      const unnamed = [
        // outside the project, whatever the kind
        ...["files", "docs-pages", "search", "search-pages", "usage", "reach", "texts"].map((kind) =>
          groupAddress(kind, outside, ["*"])
        ),
        // inside it, a module no source reaches
        groupAddress("files", project, ["./src/*"]),
        // a kind of another group's patterns: a search of the pages for a story group's files
        groupAddress("search-pages", project, OWN_STORIES)
      ];
      for (const address of [...unnamed, ...unnamed]) {
        const answer = await ask(port, address, TOOL_SCRIPT);
        expect(answer.status, address).toBe(404);
        expect(answer.body).not.toContain(SECRET);
        expect(answer.body).not.toMatch(/x\.stories|id_rsa|own\.stories/);
      }
      const file = await ask(port, fsAddress(`${outside}/id_rsa`));
      expect(file.status).toBeGreaterThanOrEqual(403);
      expect(file.body).not.toContain(SECRET);
    });
  });

  describe("without a configuration", () => {
    it("answers a group only once a module imports it, and 404 before", async () => {
      const port = await start(forgebookPlugin({ framework: STUB_FRAMEWORK }));
      const address = groupAddress("files", project, ["./src/*"]);
      expect((await ask(port, address, TOOL_SCRIPT)).status).toBe(404);
      const importer = await ask(port, "/unread.ts", OWN_SCRIPT);
      expect(importer.status).toBe(200);
      expect((await ask(port, address, OWN_SCRIPT)).body).toContain("own.stories.tsx");
    });

    it("tells a module runner why", async () => {
      await start(forgebookPlugin({ framework: STUB_FRAMEWORK }));
      const id = `\0virtual:forgebook-files:${storyFilesGroupText(outside, ["*"])}`;
      await expect(server?.ssrLoadModule(id)).rejects.toThrow(/no module of the project imports/);
    });
  });
});

describe("devServerAccess", () => {
  it("refuses no group where no dev server runs, as in a build", async () => {
    const access = devServerAccess();
    const id = `\0virtual:forgebook-files:${storyFilesGroupText("/x", ["*"])}`;
    expect(access.refusal(id)).toBeUndefined();
  });
});

describe("namingGroupOf", () => {
  const group = storyFilesGroupText("/x", ["*"]);

  it.each(["usage", "reach", "search", "texts", "files"])("reads %s as its story files' group", (kind) => {
    expect(namingGroupOf(`\0virtual:forgebook-${kind}:${group}`)).toBe(`\0virtual:forgebook-files:${group}`);
  });

  it.each(["search-pages", "docs-pages"])("reads %s as its docs pages' group", (kind) => {
    expect(namingGroupOf(`\0virtual:forgebook-${kind}:${group}`)).toBe(
      `\0virtual:forgebook-docs-pages:${group}`
    );
  });
});

describe("namesGroup", () => {
  it.each([
    'import files from "./src/*.stories.ts?forgebook-files";',
    'import docs from "./docs/*.md?forgebook-docs-pages";',
    'import("virtual:forgebook-search:/x::0::*")'
  ])("finds a group's name in %s", (code) => {
    expect(namesGroup(code)).toBe(true);
  });

  it.each(["export const a = 1;", 'import docs from "./x.stories.ts?forgebook-docs";'])(
    "finds none in %s",
    (code) => {
      expect(namesGroup(code)).toBe(false);
    }
  );
});
