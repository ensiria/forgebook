/**
 * Tests for the catalogue's Vite plugin: a `?forgebook-files` import answered with one module per pattern, the folders
 * it is given watched, and a story file added or removed there renewing the patterns' modules and reloading the page.
 *
 * @module
 */
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import type { UserConfig } from "vite";
import { describe, expect, it } from "vitest";

import { codeLiteral } from "../src/codeLiteral.ts";
import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { forgebookPlugin } from "../src/vite/forgebookPlugin.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";
import { KIT_DIR } from "./fixturePaths.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A dev server reduced to what the plugin touches, recording what it does. */
const fakeServer = (): {
  added: string[];
  invalidated: string[];
  reloads: number;
  emit: (event: "add" | "unlink", file: string) => void;
  server: unknown;
} => {
  const listeners = new Map<string, (file: string) => void>();
  const record = { added: [] as string[], invalidated: [] as string[], reloads: 0 };
  const server = {
    // the catalogue's pages answer here; a plugin without a configuration passes every request on
    middlewares: { use: (): undefined => undefined },
    // a watcher that polls, as on every system: no file is followed one by one (`closeWatch.ts`)
    config: { server: { watch: { usePolling: true } } },
    watcher: {
      add: (paths: string[]): void => void record.added.push(...paths),
      on: (event: string, listener: (file: string) => void): void => void listeners.set(event, listener)
    },
    environments: {
      client: {
        moduleGraph: {
          getModuleById: (id: string): { id: string } => ({ id }),
          invalidateModule: (module: { id: string }): void => void record.invalidated.push(module.id)
        }
      }
    },
    ws: {
      send: (): void => {
        record.reloads += 1;
      },
      // the frames' errors arrive here (`liveErrors.ts`); none in these tests
      on: (): void => undefined
    }
  };
  return {
    get added(): string[] {
      return record.added;
    },
    get invalidated(): string[] {
      return record.invalidated;
    },
    get reloads(): number {
      return record.reloads;
    },
    emit: (event: "add" | "unlink", file: string): void => listeners.get(event)?.(file),
    server
  };
};

/** The fixture package, whose story files the patterns match. */
const KIT: string = KIT_DIR;

/** The plugin's hooks, called as Vite calls them, with the files a load asked to watch. */
const hooksOf = (
  plugin: ReturnType<typeof forgebookPlugin>
): {
  resolveId: (source: string, importer: string) => unknown;
  load: (id: string) => unknown;
  configureServer: (server: unknown) => void;
  closeBundle: () => Promise<unknown>;
  watched: string[];
} => {
  const { resolveId, load, configureServer, closeBundle } = plugin;
  if (
    typeof resolveId !== "function" ||
    typeof load !== "function" ||
    typeof configureServer !== "function" ||
    typeof closeBundle !== "function"
  )
    throw new Error("missing hooks");
  const watched: string[] = [];
  const context = {
    addWatchFile: (file: string): void => void watched.push(file),
    error: (message: string): never => {
      throw new Error(message);
    }
  };
  return {
    resolveId: (source: string, importer: string): unknown =>
      resolveId.call(context as never, source, importer, { isEntry: false } as never),
    load: (id: string): unknown => load.call(context as never, id),
    configureServer: (server: unknown): void =>
      void configureServer.call(undefined as never, server as never),
    // ends the docs' worker a request started
    closeBundle: async (): Promise<unknown> => closeBundle.call(undefined as never),
    watched
  };
};

describe("forgebookPlugin's ?forgebook-files modules", () => {
  it("answers a pattern with one module: each file's index and the loaders of its module, docs and code", async () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }));
    const id = hooks.resolveId("./src/*.stories.tsx?forgebook-files", join(KIT, "stories.ts"));
    expect(typeof id).toBe("string");
    const loaded = await hooks.load(String(id));
    await hooks.closeBundle();
    const code = typeof loaded === "object" && loaded !== null && "code" in loaded ? String(loaded.code) : "";
    expect(code).toContain(
      `[${codeLiteral("./src/Select.stories.tsx")}, {"title":${codeLiteral("Inputs/Selection/Select")}`
    );
    // in Vite's form, which the queries' ids come back to the plugin in: forward slashes on Windows too
    expect(code).toContain(`() => import(${codeLiteral(VITE_PATHS.join(KIT, "src", "Select.stories.tsx"))})`);
    expect(code).toContain("?forgebook-docs");
    expect(code).toContain("?forgebook-code");
    expect(hooks.watched).toContain(VITE_PATHS.join(KIT, "src", "Select.stories.tsx"));
  });

  it("names a pattern that climbs out of its folder without a `..` in the id, which a URL path would collapse", async () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }));
    const id = String(
      hooks.resolveId(
        "./../kit/src/*.stories.tsx?forgebook-files",
        join(KIT, "..", "app", "forgebook.config.ts")
      )
    );
    expect(id.split(/[/:]/)).not.toContain("..");
    const loaded = await hooks.load(id);
    await hooks.closeBundle();
    const code = typeof loaded === "object" && loaded !== null && "code" in loaded ? String(loaded.code) : "";
    // keys stay relative to the declaring module, so two patterns of one source never share one
    expect(code).toContain(
      `[${codeLiteral("../kit/src/Select.stories.tsx")}, {"title":${codeLiteral("Inputs/Selection/Select")}`
    );
  });

  it("leaves every other import to Vite", () => {
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }));
    expect(hooks.resolveId("./src/Select.tsx", join(KIT, "stories.ts"))).toBeNull();
  });
});

describe("forgebookPlugin's pages", () => {
  /** A catalogue whose folder is named as Vite names it on Windows: its ids have forward slashes. */
  const config: ResolvedConfig = {
    dir: "C:/Users/ada/app",
    framework: STUB_FRAMEWORK,
    title: "Catalogue",
    logo: undefined,
    heights: undefined,
    stories: ["src/**/*.stories.tsx"],
    docs: [],
    sources: [],
    switches: undefined,
    languages: [],
    previews: [],
    head: "",
    shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
    tokens: [],
    watch: [],
    lists: {},
    plugins: [],
    home: undefined,
    hasPlayTools: false,
    frames: ISOLATED_FRAMES,
    build: { readableNames: false }
  };

  it("resolves the pages' entries by their address to their path in the folder, and answers them", async () => {
    const hooks = hooksOf(forgebookPlugin({ config }));
    expect(hooks.resolveId("/.forgebook-shell.ts", "C:/Users/ada/app/index.html")).toBe(
      "C:/Users/ada/app/.forgebook-shell.ts"
    );
    expect(hooks.resolveId("/frame.html", "")).toBe("C:/Users/ada/app/frame.html");
    const shell = await hooks.load("C:/Users/ada/app/.forgebook-shell.ts");
    const code = typeof shell === "object" && shell !== null && "code" in shell ? String(shell.code) : "";
    expect(code).toContain("mountShell(root");
    expect(code).toContain(`from ${codeLiteral("C:/Users/ada/app/.forgebook-stories.ts")};`);
  });

  it("names a build's scripts by their hash alone, and after their modules when the configuration asks", async () => {
    /**
     * The chunk names the plugin sets for a build of a configuration.
     *
     * @param readableNames - the configuration's option.
     * @param userConfig - the app's Vite configuration.
     */
    const chunkNames = async (readableNames: boolean, userConfig: UserConfig = {}): Promise<unknown> => {
      const { config: hook } = forgebookPlugin({ config: { ...config, build: { readableNames } } });
      if (typeof hook !== "function") throw new Error("no config hook");
      const set: unknown = await Reflect.apply(hook, undefined, [
        userConfig,
        { command: "build", mode: "production" }
      ]);
      const field = (value: unknown, key: string): unknown =>
        typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
      return field(field(field(field(set, "build"), "rolldownOptions"), "output"), "chunkFileNames");
    };
    expect(await chunkNames(false)).toBe("assets/[hash].js");
    expect(await chunkNames(true)).toBeUndefined();
    // an app that names its output keeps its names
    const named: UserConfig = { build: { rolldownOptions: { output: { entryFileNames: "[name].js" } } } };
    expect(await chunkNames(false, named)).toBeUndefined();
  });

  it("answers the project's stories' source by the path the entry imports it with", async () => {
    const hooks = hooksOf(forgebookPlugin({ config }));
    const id = hooks.resolveId(
      "C:/Users/ada/app/.forgebook-stories.ts",
      "C:/Users/ada/app/.forgebook-shell.ts"
    );
    expect(id).toBe("C:/Users/ada/app/.forgebook-stories.ts");
    const source = await hooks.load(String(id));
    const code = typeof source === "object" && source !== null && "code" in source ? String(source.code) : "";
    expect(code).toContain(`${codeLiteral("./src/**/*.stories.tsx?forgebook-files")}`);
  });
});

describe("forgebookPlugin in the dev server", () => {
  it("watches the given folders", () => {
    const fake = fakeServer();
    hooksOf(
      forgebookPlugin({ framework: STUB_FRAMEWORK, watch: ["/kit/src", "/kit/stories"] })
    ).configureServer(fake.server);
    expect(fake.added).toEqual(["/kit/src", "/kit/stories"]);
  });

  it("renews the patterns' modules and reloads when a story file is added or removed", async () => {
    const fake = fakeServer();
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK, watch: ["/kit/src"] }));
    const id = String(hooks.resolveId("./src/*.stories.tsx?forgebook-files", join(KIT, "stories.ts")));
    await hooks.load(id);
    await hooks.closeBundle();
    hooks.configureServer(fake.server);
    fake.emit("add", "/kit/src/a/A.stories.tsx");
    fake.emit("unlink", "/kit/src/a/A.stories.tsx");
    fake.emit("add", "/kit/src/a/A.tsx");
    expect(fake.invalidated).toEqual([id, id]);
    expect(fake.reloads).toBe(2);
  });

  it("renews them too in a catalogue that watches no folder of its own: a story file renamed in its own folder", async () => {
    const fake = fakeServer();
    const hooks = hooksOf(forgebookPlugin({ framework: STUB_FRAMEWORK }));
    const id = String(hooks.resolveId("./src/*.stories.tsx?forgebook-files", join(KIT, "stories.ts")));
    await hooks.load(id);
    await hooks.closeBundle();
    hooks.configureServer(fake.server);
    fake.emit("unlink", join(KIT, "src", "Old.stories.tsx"));
    fake.emit("add", join(KIT, "src", "New.stories.tsx"));
    expect(fake.added).toEqual([]);
    expect(fake.invalidated).toEqual([id, id]);
    expect(fake.reloads).toBe(2);
  });
});

/**
 * A build's load of the fixture kit's pattern, in one of the build's environments, with its texts module when it
 * imports one and the files they wrote.
 *
 * @param environment - the environment's name: `client` for the pages' files.
 */
const builtPattern = async (
  environment: string
): Promise<{
  readonly code: string;
  readonly texts: string | undefined;
  readonly emitted: ReadonlyMap<string, Uint8Array>;
}> => {
  const plugin = forgebookPlugin({ framework: STUB_FRAMEWORK });
  const { config: configHook, resolveId, load, closeBundle } = plugin;
  if (
    typeof configHook !== "function" ||
    typeof resolveId !== "function" ||
    typeof load !== "function" ||
    typeof closeBundle !== "function"
  )
    throw new Error("missing hooks");
  await Reflect.apply(configHook, undefined, [{}, { command: "build", mode: "production" }]);
  const emitted = new Map<string, Uint8Array>();
  const context = {
    environment: { name: environment },
    addWatchFile: (): undefined => undefined,
    emitFile: (asset: { fileName: string; source: Uint8Array }): string => {
      emitted.set(asset.fileName, asset.source);
      return asset.fileName;
    },
    resolve: async (): Promise<null> => null,
    error: (message: string): never => {
      throw new Error(message);
    }
  };
  const codeOf = async (source: string, importer: string): Promise<string> => {
    const id: unknown = Reflect.apply(resolveId, context, [source, importer, { isEntry: false }]);
    const loaded: unknown = await Reflect.apply(load, context, [String(id)]);
    return typeof loaded === "object" && loaded !== null && "code" in loaded ? String(loaded.code) : "";
  };
  const code = await codeOf("./src/*.stories.tsx?forgebook-files", join(KIT, "stories.ts"));
  const textsImport = /^import texts from ("[^"]+");$/m.exec(code)?.[1];
  const texts = textsImport === undefined ? undefined : await codeOf(JSON.parse(textsImport), "");
  await Reflect.apply(closeBundle, undefined, []);
  return { code, texts, emitted };
};

/**
 * Each row's first column of a pattern's module, its file's key, in order.
 *
 * @param code - the module's code.
 */
const rowKeys = (code: string): string[] =>
  [...code.matchAll(/^(?:const rows = \[)?\[("\.\\u002fsrc\\u002f[^"]+")/gm)].map((match) =>
    JSON.parse(match[1] ?? "")
  );

describe("forgebookPlugin in a build", () => {
  it("writes a pattern's docs, code and pages as data, never a module each: a file a page asks for, or the text", async () => {
    const { code, texts, emitted } = await builtPattern("client");
    expect(code).not.toMatch(/\?forgebook-(docs|code|page)/);
    // the texts' rows are the pattern's, in the same order
    const at = rowKeys(code).indexOf("./src/Select.stories.tsx");
    expect(at).toBeGreaterThan(-1);
    const rows = (texts ?? "").split("export default [")[1]?.split(",\n") ?? [];
    expect(rows).toHaveLength(rowKeys(code).length);
    // its stories have a render and its component a page: both worth a file
    const files = [...(rows[at] ?? "").matchAll(/packedText\(("assets\\u002f[0-9a-f]{12}\.bin")\)/g)].map(
      (match) => String(JSON.parse(match[1] ?? ""))
    );
    expect(files).toHaveLength(2);
    const written = files.map((file) => gunzipSync(emitted.get(file) ?? new Uint8Array()).toString());
    expect(written.some((text) => text.includes("select.inRow.caption"))).toBe(true);
    expect(written.some((text) => text.includes("Lets the user pick one value"))).toBe(true);
  });

  it("keeps the queries in a server environment's build, whose output no page fetches", async () => {
    const { code, texts, emitted } = await builtPattern("ssr");
    expect(code).toContain("?forgebook-docs");
    expect(code).toContain("?forgebook-code");
    expect(code).toContain("?forgebook-page");
    expect(texts).toBeUndefined();
    expect(emitted.size).toBe(0);
  });
});
