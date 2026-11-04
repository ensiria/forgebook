/**
 * Tests for the SvelteKit plugin: the aliases it gives, the settings it writes in the frame's page, the environment
 * modules and the server-only ones.
 *
 * @module
 */
import { join, win32 } from "node:path";

import { codeLiteral } from "forgebook/code-literal";
import { vitePathsOf } from "forgebook/vite/paths";
import { normalizePath, type Plugin, type ResolvedConfig } from "vite";
import { describe, expect, it } from "vitest";

import {
  declaredPublicVariables,
  namedServerImports,
  publicVariables,
  serverOnlyModule
} from "../../src/vite/envModules.ts";
import { kitPlugin, pageScript, projectAliases } from "../../src/vite/kitPlugin.ts";
import type { KitProject } from "../../src/vite/kitProject.ts";

/** The test projects' folder. */
const FIXTURES = join(import.meta.dirname, "..", "fixtures");

/**
 * A project with SvelteKit's options.
 *
 * @param kit - the options.
 * @param dir - its folder.
 * @param version - SvelteKit's major version.
 */
const project = (
  kit: Readonly<Record<string, unknown>>,
  dir = join(FIXTURES, "kit2"),
  version: 2 | 3 = 2
): KitProject => ({
  dir,
  kit,
  version,
  extensions: [".svelte"],
  svelte: undefined,
  plugins: [],
  problem: undefined
});

/**
 * A module the plugin writes, as Vite loads it.
 *
 * @param plugin - the plugin.
 * @param source - the module's name.
 */
const loaded = async (plugin: Plugin, source: string): Promise<string | undefined> => {
  const resolveId = plugin.resolveId;
  const load = plugin.load;
  if (typeof resolveId !== "function" || typeof load !== "function")
    throw new Error("The plugin resolves nothing");
  const id: unknown = await Reflect.apply(resolveId, {}, [source, undefined, {}]);
  if (typeof id !== "string") return undefined;
  const result: unknown = await Reflect.apply(load, { addWatchFile: (): void => undefined }, [id]);
  return typeof result === "string" ? result : undefined;
};

/**
 * The plugin, configured for a project in development.
 *
 * @param kit - SvelteKit's options.
 * @param dir - the project's folder.
 * @param version - SvelteKit's major version.
 */
const configured = (kit: Readonly<Record<string, unknown>>, dir?: string, version: 2 | 3 = 2): Plugin => {
  const plugin = kitPlugin(project(kit, dir, version));
  const { configResolved } = plugin;
  if (typeof configResolved !== "function") throw new Error("The plugin reads no configuration");
  const config: Pick<ResolvedConfig, "mode" | "logger"> = {
    mode: "development",
    logger: {
      warn: (): void => undefined,
      info: (): void => undefined,
      warnOnce: (): void => undefined,
      error: (): void => undefined,
      clearScreen: (): void => undefined,
      hasErrorLogged: (): boolean => false,
      hasWarned: false
    }
  };
  Reflect.apply(configResolved, {}, [config]);
  return plugin;
};

describe("the aliases", () => {
  it("gives $lib where the project keeps it, and SvelteKit's alias option as SvelteKit writes it", () => {
    const aliases = projectAliases(
      project({
        files: { lib: "src/library" },
        alias: Object.fromEntries([
          ["$ui", "src/ui"],
          ["$icons/*", "src/icons/*"]
        ])
      })
    );
    const replaced = (name: string): string | undefined => {
      const alias = aliases.find((each) =>
        typeof each.find === "string" ? each.find === name : each.find.test(name)
      );
      return alias === undefined ? undefined : name.replace(alias.find, alias.replacement);
    };
    expect(replaced("$lib")).toBe(normalizePath(join(FIXTURES, "kit2", "src/library")));
    expect(replaced("$lib/site")).toBe(normalizePath(join(FIXTURES, "kit2", "src/library/site")));
    expect(replaced("$ui/Button.svelte")).toBe(normalizePath(join(FIXTURES, "kit2", "src/ui/Button.svelte")));
    expect(replaced("$icons/star.svg")).toBe(normalizePath(join(FIXTURES, "kit2", "src/icons/star.svg")));
    expect(replaced("$icons")).toBeUndefined();
    expect(replaced("$library")).toBeUndefined();
  });

  it("leads to paths in Vite's form on Windows, a name's rest after them included", () => {
    const aliases = projectAliases(
      {
        dir: "C:\\app",
        kit: {
          files: { lib: "src\\library" },
          alias: Object.fromEntries([
            ["$ui", "D:\\shared\\ui"],
            ["$icons/*", "src/icons/*"]
          ])
        }
      },
      vitePathsOf(win32)
    );
    const replaced = (name: string): string | undefined => {
      const alias = aliases.find((each) =>
        typeof each.find === "string" ? each.find === name : each.find.test(name)
      );
      return alias === undefined ? undefined : name.replace(alias.find, alias.replacement);
    };
    expect(replaced("$lib")).toBe("C:/app/src/library");
    expect(replaced("$lib/site")).toBe("C:/app/src/library/site");
    expect(replaced("$ui/Button.svelte")).toBe("D:/shared/ui/Button.svelte");
    expect(replaced("$icons/star.svg")).toBe("C:/app/src/icons/star.svg");
  });

  it("writes the settings in the frame's page with no way to close its script", () => {
    const script = pageScript({ base: "", assets: "", version: "</script>", routes: [], staticFiles: [] });
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c\\u002fscript\\u003e");
  });
});

describe("the environment", () => {
  it("gives SvelteKit 2's public variables, by their prefix and not the private one", () => {
    const env = { APP_NAME: "Kit", APP_SECRET_KEY: "no", SECRET: "no" };
    expect(publicVariables(env, "APP_", "")).toEqual({ APP_NAME: "Kit", APP_SECRET_KEY: "no" });
    expect(publicVariables(env, "APP_", "APP_SECRET")).toEqual({ APP_NAME: "Kit" });
  });

  it("writes $env/static/public and $env/dynamic/public from the project's .env, nothing private in them", async () => {
    const plugin = configured({ env: { publicPrefix: "PUBLIC_" } }, join(FIXTURES, "kit3"));
    const staticPublic = await loaded(plugin, "$env/static/public");
    expect(staticPublic).toContain('export const PUBLIC_RETRIES = "3";');
    expect(staticPublic).not.toContain("hidden");
    expect(await loaded(plugin, "$env/dynamic/public")).toContain(
      `"PUBLIC_TITLE":${codeLiteral("Kit </script> three")}`
    );
  });

  it("writes SvelteKit 3's $app/env/public from the variables src/env.ts declares public, checked by their schema", async () => {
    const declared = await declaredPublicVariables(join(FIXTURES, "kit3", "src"), {
      PUBLIC_RETRIES: "5",
      PUBLIC_TITLE: "",
      SECRET_KEY: "hidden"
    });
    expect(declared?.values).toEqual({ PUBLIC_RETRIES: 5, PUBLIC_TITLE: "" });
    // a variable with no schema must be set, as SvelteKit wants it
    await expect(
      declaredPublicVariables(join(FIXTURES, "kit3", "src"), { PUBLIC_RETRIES: "5" })
    ).rejects.toThrow("PUBLIC_TITLE is missing");
    const module = await loaded(configured({}, join(FIXTURES, "kit3"), 3), "$app/env/public");
    expect(module).toContain("export const PUBLIC_RETRIES = 3;");
    expect(module).not.toContain("hidden");
  });

  it("refuses the other SvelteKit's public environment, so SvelteKit 3 gives no variable by its prefix alone", async () => {
    const kit3 = configured({}, join(FIXTURES, "kit3"), 3);
    for (const name of ["$env/static/public", "$env/dynamic/public"]) {
      const module = await loaded(kit3, name);
      expect(module).toContain("is SvelteKit 2's");
      expect(module).not.toContain("PUBLIC_RETRIES");
    }
    expect(await loaded(configured({}, join(FIXTURES, "kit3"), 2), "$app/env/public")).toContain(
      "is SvelteKit 3's"
    );
    const rewritten = namedServerImports('import { PUBLIC_A } from "$env/static/public";') ?? "";
    expect(rewritten).toContain('"$env/static/public?names=PUBLIC_A"');
    expect(await loaded(kit3, "$env/static/public?names=PUBLIC_A")).toContain(
      "export const PUBLIC_A = undefined;"
    );
  });

  it("refuses every server-only module with why, declaring the names its importer asked for", async () => {
    const code =
      'import { SECRET_KEY, OTHER as other } from "$app/env/private";\nimport { page } from "$app/state";';
    const rewritten = namedServerImports(code) ?? "";
    expect(rewritten).toContain('from "$app/env/private?names=SECRET_KEY,OTHER"');
    expect(rewritten).toContain('from "$app/state"');
    expect(namedServerImports('import { page } from "$app/state";')).toBeUndefined();
    const module = serverOnlyModule("$app/env/private?names=SECRET_KEY,OTHER");
    expect(module).toMatch(/^throw new Error\(".*only a server may load/);
    expect(module).toContain("export const SECRET_KEY = undefined;");
    const plugin = configured({}, join(FIXTURES, "kit3"));
    for (const name of ["$env/static/private", "$app/server", "$service-worker"])
      expect(await loaded(plugin, name)).toContain("only a server may load");
  });
});
