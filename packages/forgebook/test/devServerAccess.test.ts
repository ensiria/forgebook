/**
 * Tests for what a client of a real dev server can reach on both of its ports: only the groups of files the project
 * names and what Vite would serve, whatever address it asks for, and nothing at all when it is another site's page.
 *
 * @remarks
 * Every request is written by hand (`rawRequest.ts`).
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { forgebookPlugin } from "../src/vite/forgebookPlugin.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";
import { ask, fsAddress, listenOnFreePort, OWN_SCRIPT, portOf, TOOL_SCRIPT } from "./fixtures/rawRequest.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** What every file a client must not read holds. */
const SECRET = "TOP-SECRET";

/** A story file's text. */
const STORY = `export default { title: "Named" }; export const One = {}; // ${SECRET}\n`;

/** The headers of another site's page framing an address. */
const FRAMED_ELSEWHERE = {
  "sec-fetch-site": "cross-site",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "iframe"
};

describe("a dev server's two ports", () => {
  let base = "";
  let project = "";
  let outside = "";
  let named = "";
  let server: ViteDevServer;
  let catalogue = 0;
  let frames = 0;

  beforeAll(async () => {
    // the real path in Vite's form: a temporary folder may be a link or a Windows short name, and every address below
    // is written from these
    base = VITE_PATHS.normalize(realpathSync.native(mkdtempSync(join(tmpdir(), "forgebook-access-"))));
    project = `${base}/project`;
    outside = `${base}/outside`;
    named = `${base}/named`;
    for (const folder of [join(project, "src"), join(project, "docs"), outside, named])
      mkdirSync(folder, { recursive: true });
    writeFileSync(join(project, "src", "listed.stories.tsx"), "export default {}; export const One = {};\n");
    writeFileSync(join(project, "src", "denied.stories.tsx"), STORY);
    writeFileSync(join(project, "docs", "page.md"), "# Page\n\nA page.\n");
    writeFileSync(join(project, "docs", "denied.md"), `# Denied\n\n${SECRET}\n`);
    writeFileSync(join(project, ".env"), `KEY=${SECRET}\n`);
    writeFileSync(join(outside, "x.stories.tsx"), STORY);
    writeFileSync(join(outside, "note.md"), `# Note\n\n${SECRET}\n`);
    writeFileSync(join(outside, "id_rsa"), `${SECRET}\n`);
    writeFileSync(join(named, "named.stories.tsx"), "export default {}; export const Two = {};\n");
    const config: ResolvedConfig = {
      title: "Access",
      argControls: {},
      logo: undefined,
      heights: undefined,
      dir: project,
      framework: STUB_FRAMEWORK,
      stories: ["src/**/*.stories.tsx", "../named/*.stories.tsx"],
      docs: ["docs/*.md"],
      sources: [],
      switches: undefined,
      languages: [],
      previews: [],
      head: "",
      shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
      tokens: [],
      watch: [],
      lists: { usedIn: false },
      plugins: [],
      home: undefined,
      hasPlayTools: false,
      frames: ISOLATED_FRAMES,
      build: { readableNames: false }
    };
    server = await createServer({
      root: project,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
      server: {
        host: "127.0.0.1",
        port: 0,
        watch: null,
        fs: { allow: [project], deny: [".env", "**/denied.*"] }
      },
      plugins: [forgebookPlugin({ config })]
    });
    await listenOnFreePort(server);
    catalogue = portOf(server);
    // the next free port when the catalogue's + 1 is taken: read from where its page sends a frame
    const framePage = await ask(catalogue, "/frame.html?story=a--b", FRAMED_ELSEWHERE);
    frames = Number(new URL(framePage.location ?? "").port);
  });

  afterAll(async () => {
    await server.close();
    rmSync(base, { recursive: true, force: true });
  });

  /** The addresses of the catalogue's own modules that name a group of its files, read from the module that imports them. */
  const ownGroups = async (): Promise<readonly string[]> => {
    const { body } = await ask(catalogue, `/@id/${project}/.forgebook-stories.ts`, OWN_SCRIPT);
    return [...body.matchAll(/"(\/@id\/__x00__virtual:forgebook-[^"]+)"/g)].flatMap(([, url]) => url ?? []);
  };

  describe("reads nothing the project does not name", () => {
    it.each([
      "forgebook-files",
      "forgebook-docs-pages",
      "forgebook-usage",
      "forgebook-reach",
      "forgebook-search",
      "forgebook-search-pages",
      "forgebook-texts"
    ])("answers virtual:%s of a folder nothing imports with nothing", async (kind) => {
      const answer = await ask(catalogue, `/@id/__x00__virtual:${kind}:${outside}::0::*`, TOOL_SCRIPT);
      expect(answer.status).toBe(404);
      expect(answer.body).not.toContain(SECRET);
      expect(answer.body).not.toMatch(/x\.stories|note\.md|id_rsa/);
    });

    it("answers a group named without Rollup's mark the same way", async () => {
      const answer = await ask(catalogue, `/@id/virtual:forgebook-files:${outside}::0::*`, TOOL_SCRIPT);
      expect(answer.body).not.toMatch(/x\.stories|id_rsa/);
    });

    it("lists nothing for a pattern only an address names", async () => {
      const address = "/@id/../outside/*?forgebook-files";
      const answer = await ask(catalogue, address, TOOL_SCRIPT);
      expect(answer.body).not.toMatch(/x\.stories|id_rsa/);
    });

    it("takes no pattern from the query of an address its importer was asked by", async () => {
      writeFileSync(
        join(project, "relative.ts"),
        'import files from "./src/listed*?forgebook-files";\nexport default files;\n'
      );
      const smuggled = `${outside}/*::0::z`;
      const primed = await ask(catalogue, `/relative.ts?a=::0::${smuggled}/y`, TOOL_SCRIPT);
      const group = /"(\/@id\/__x00__virtual:forgebook-files:[^"]+)"/.exec(primed.body)?.[1];
      const answers = await Promise.all([
        ...(group === undefined ? [] : [ask(catalogue, group, TOOL_SCRIPT)]),
        ask(
          catalogue,
          `/@id/virtual:forgebook-docs-pages:${project}/relative.ts?a=::0::${smuggled}`,
          TOOL_SCRIPT
        )
      ]);
      for (const answer of answers) {
        expect(answer.body).not.toContain(SECRET);
        expect(answer.body).not.toMatch(/x\.stories|id_rsa/);
      }
      // 403 or, on Windows, 404: Vite turns it down either way
      const refused = await ask(catalogue, fsAddress(`${outside}/id_rsa`));
      expect(refused.status).toBeGreaterThanOrEqual(403);
      expect(refused.body).not.toContain(SECRET);
    });

    it("does not make Vite serve a file by naming it in a group", async () => {
      await ask(catalogue, `/@id/virtual:forgebook-files:${outside}::0::*`, TOOL_SCRIPT);
      const answer = await ask(catalogue, fsAddress(`${outside}/id_rsa`));
      // 403 or, on Windows, 404: Vite turns it down either way
      expect(answer.status).toBeGreaterThanOrEqual(403);
      expect(answer.body).not.toContain(SECRET);
    });

    it.each(["forgebook-markdown", "forgebook-code", "forgebook-docs-page", "forgebook-home"])(
      "keeps ?%s inside server.fs, through a folder it allows too",
      async (query) => {
        const paths = [
          fsAddress(`${outside}/note.md`),
          `/@id/${project}/../outside/note.md`,
          `/@id/${project}/.env`,
          `/@id/${project}/docs/denied.md`
        ];
        for (const path of paths) {
          const answer = await ask(catalogue, `${path}?${query}`, TOOL_SCRIPT);
          expect(answer.body).not.toContain(SECRET);
        }
      }
    );
  });

  describe("reads what the project names", () => {
    it("serves the catalogue's groups, less what server.fs.deny refuses", async () => {
      const groups = await ownGroups();
      const [files, pages] = [
        groups.find((url) => url.includes("forgebook-files")),
        groups.find((url) => url.includes("forgebook-docs-pages"))
      ];
      if (files === undefined || pages === undefined) throw new Error("The catalogue imports no group");
      const listed = await ask(catalogue, files, OWN_SCRIPT);
      expect(listed.body).toContain("listed.stories.tsx");
      expect(listed.body).not.toContain("denied.stories.tsx");
      const docs = await ask(catalogue, pages, OWN_SCRIPT);
      expect(docs.body).toContain("page.md");
      expect(docs.body).not.toContain("denied.md");
    });

    it.skipIf(process.platform === "win32")("judges a link by the file it leads to", async () => {
      const file = join(project, "src", "link.stories.tsx");
      symlinkSync(join(project, "src", "denied.stories.tsx"), file);
      writeFileSync(
        join(project, "linked.ts"),
        'import files from "./src/l*?forgebook-files";\nexport default files;\n'
      );
      const { body } = await ask(catalogue, "/linked.ts", OWN_SCRIPT);
      const group = /"(\/@id\/__x00__virtual:forgebook-files:[^"]+)"/.exec(body)?.[1];
      if (group === undefined) throw new Error("The source imports no group");
      const listed = await ask(catalogue, group, OWN_SCRIPT);
      rmSync(file);
      expect(listed.body).toContain("listed.stories.tsx");
      expect(listed.body).not.toContain("link.stories.tsx");
    });

    it("keeps a search index to the same files", async () => {
      const pages = (await ownGroups()).find((url) => url.includes("forgebook-docs-pages"));
      if (pages === undefined) throw new Error("The catalogue imports no docs pages");
      const { body } = await ask(catalogue, pages, OWN_SCRIPT);
      const search = /"(\/@id\/__x00__virtual:forgebook-search-pages:[^"]+)"/.exec(body)?.[1];
      if (search === undefined) throw new Error("The docs pages name no search index");
      const index = await ask(catalogue, search, OWN_SCRIPT);
      expect(index.body).toContain("A page.");
      expect(index.body).not.toContain(SECRET);
    });

    it("lists and serves a story file the configuration names outside server.fs.allow, as an import is", async () => {
      const files = (await ownGroups()).find((url) => url.includes("forgebook-files"));
      if (files === undefined) throw new Error("The catalogue imports no story files");
      const listed = await ask(catalogue, files, OWN_SCRIPT);
      expect(listed.body).toContain("named.stories.tsx");
      const story = await ask(catalogue, fsAddress(`${named}/named.stories.tsx`), OWN_SCRIPT);
      expect(story.status).toBe(200);
    });

    it("answers a source's own `?forgebook-files` import", async () => {
      writeFileSync(
        join(project, "handWritten.ts"),
        'import files from "./src/listed*?forgebook-files";\nexport default files;\n'
      );
      const { body } = await ask(catalogue, "/handWritten.ts", OWN_SCRIPT);
      const group = /"(\/@id\/__x00__virtual:forgebook-files:[^"]+)"/.exec(body)?.[1];
      if (group === undefined) throw new Error("The source imports no group");
      expect((await ask(catalogue, group, OWN_SCRIPT)).body).toContain("listed.stories.tsx");
    });

    it("serves a group refused before the module that imports it was first read", async () => {
      writeFileSync(
        join(project, "late.ts"),
        'import files from "./src/listed*?forgebook-files";\nexport default files;\n'
      );
      const { body } = await ask(catalogue, "/late.ts", OWN_SCRIPT);
      const group = /"(\/@id\/__x00__virtual:forgebook-files:[^"]+)"/.exec(body)?.[1];
      if (group === undefined) throw new Error("The source imports no group");
      // another folder's copy of the import, whose id no module has imported yet
      writeFileSync(
        join(project, "src", "later.ts"),
        'import files from "./listed*?forgebook-files";\nexport default files;\n'
      );
      const later = group.replace(`${project}::0::src/listed*`, `${project}/src::0::listed*`);
      expect((await ask(catalogue, later, TOOL_SCRIPT)).status).toBe(404);
      await ask(catalogue, "/src/later.ts", OWN_SCRIPT);
      expect((await ask(catalogue, later, OWN_SCRIPT)).body).toContain("listed.stories.tsx");
    });

    it("answers a tool's question on the agent API, without a browser's headers", async () => {
      const answer = await ask(catalogue, "/__forgebook/api/stories");
      expect(answer.status).toBe(200);
      expect(answer.body).toContain('"schema"');
    });
  });

  describe("refuses another site's page", () => {
    const ForeignOrigin = { origin: "https://evil.example" };
    const CrossSite = {
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-dest": "script"
    };
    const SameSite = { "sec-fetch-site": "same-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };

    it.each([
      ["a foreign Origin", ForeignOrigin],
      ["a cross-site script", CrossSite],
      ["a same-site fetch", SameSite]
    ])("turns down %s on both ports", async (_name, headers) => {
      for (const port of [catalogue, frames]) {
        for (const path of ["/__forgebook/api/stories", "/@vite/client", "/src/listed.stories.tsx"]) {
          const answer = await ask(port, path, headers);
          expect([path, answer.status]).toEqual([path, 403]);
        }
      }
    });

    it.each(["/__forgebook/api/stories", "/@vite/client", "/frame.html", "/.forgebook-stories.ts"])(
      "turns down a host name it was not told of for %s on both ports",
      async (path) => {
        for (const port of [catalogue, frames]) {
          const answer = await ask(port, path, { host: `evil.example:${port}` });
          expect([port, answer.status]).toEqual([port, 403]);
        }
      }
    );

    it("opens no module or file for another site's frame or link", async () => {
      const paths = [
        "/src/listed.stories.tsx",
        "/@vite/client",
        `${fsAddress(`${project}/src/listed.stories.tsx`)}?forgebook-code`,
        "/__open-in-editor?file=a.ts"
      ];
      for (const path of paths) {
        expect([path, (await ask(catalogue, path, FRAMED_ELSEWHERE)).status]).toEqual([path, 403]);
        expect([path, (await ask(frames, path, FRAMED_ELSEWHERE)).status]).toEqual([path, 404]);
      }
    });

    it("does not let a story's frame reach the API or a file through another spelling, or plant an address", async () => {
      const asFrame = {
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty"
      };
      for (const path of [
        "//x/__forgebook/api/stories",
        "/./__forgebook/api/stories",
        "/%2e/__forgebook/api/stories",
        "/\\x/__forgebook/api/stories"
      ])
        expect([path, (await ask(frames, path, asFrame)).status]).toEqual([path, 403]);
      // an image's request is passed on as it is, and writes its query into the module's code
      await ask(frames, "/src/listed.stories.tsx?z=/index.ts?rawX", {
        ...asFrame,
        "sec-fetch-dest": "image"
      });
      await ask(frames, `/src/listed.stories.tsx?z="/planted.ts?raw"`, {
        ...asFrame,
        "sec-fetch-dest": "image"
      });
      writeFileSync(join(project, "planted.ts"), `export const secret = "${SECRET}";\n`);
      const answer = await ask(frames, "/planted.ts?raw", asFrame);
      expect(answer.status).toBe(403);
      expect(answer.body).not.toContain(SECRET);
    });

    it("opens no HMR socket for another site's page, which holds no token, on either port", async () => {
      for (const port of [catalogue, frames]) {
        const outcome = await new Promise<string>((resolve) => {
          const sent = request({
            host: "127.0.0.1",
            port,
            path: "/",
            headers: {
              origin: "https://evil.example",
              connection: "Upgrade",
              upgrade: "websocket",
              "sec-websocket-version": "13",
              "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
              "sec-websocket-protocol": "vite-hmr"
            }
          });
          sent.on("upgrade", (_response, socket) => {
            socket.destroy();
            resolve("opened");
          });
          sent.on("response", () => resolve("refused"));
          sent.on("error", () => resolve("refused"));
          sent.end();
        });
        expect(outcome).toBe("refused");
      }
    });
  });

  describe("keeps what another site may open", () => {
    it("frames the catalogue's page, an embed", async () => {
      const answer = await ask(catalogue, "/?story=a--b", FRAMED_ELSEWHERE);
      expect(answer.status).toBe(200);
      expect(answer.body).toContain("<html");
    });

    it("frames a story's preview, a client's inline one", async () => {
      const answer = await ask(catalogue, "/__forgebook/api/preview?id=a--b", FRAMED_ELSEWHERE);
      expect(answer.status).toBe(200);
      expect(answer.body).toContain("a--b");
    });

    it("frames the frame page on the frames' port, and sends it there from the catalogue's", async () => {
      expect((await ask(frames, "/frame.html?story=a--b", FRAMED_ELSEWHERE)).status).toBe(200);
      expect((await ask(catalogue, "/frame.html?story=a--b", FRAMED_ELSEWHERE)).status).toBe(307);
    });

    it("serves the frames' port a group the catalogue imports, and Vite's client", async () => {
      const files = (await ownGroups()).find((url) => url.includes("forgebook-files"));
      if (files === undefined) throw new Error("The catalogue imports no story files");
      const asFrame = { ...OWN_SCRIPT, "sec-fetch-site": "same-origin" };
      const listed = await ask(frames, files, asFrame);
      expect(listed.body).toContain("listed.stories.tsx");
      expect((await ask(frames, "/@vite/client", asFrame)).status).toBe(200);
    });
  });
});
