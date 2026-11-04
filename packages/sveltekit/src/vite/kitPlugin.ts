/**
 * The Vite plugin that lets a SvelteKit project's components draw outside SvelteKit: `$app/*` resolved to stand-ins
 * that work in a story, `$lib` and the project's aliases, the public environment, and the project's routes written in
 * the frame's page.
 *
 * @remarks
 * What a stand-in does and why is in each module of `src/app`. The settings the stand-ins read (the base path, the
 * version, the routes) are written in the frame's page before any module runs (`appSettings.ts`), read again when a
 * route or a static file is added or removed. The environment modules are written from the project's `.env` files and
 * the environment as SvelteKit would give them to the browser (`envModules.ts`).
 *
 * @module
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { codeLiteral } from "forgebook/code-literal";
import { VITE_PATHS, type VitePaths } from "forgebook/vite/paths";
import {
  type Alias,
  type HtmlTagDescriptor,
  type IndexHtmlTransformContext,
  loadEnv,
  type Plugin,
  type ResolvedConfig,
  type UserConfig,
  type ViteDevServer
} from "vite";

import { APP_SETTINGS_KEY, type KitAppSettings, SETTINGS_CONSTANT } from "../appSettings.ts";
import {
  declaredPublicVariables,
  isServerOnly,
  kitModuleName,
  namedExports,
  namedServerImports,
  PUBLIC_ENV,
  type PublicEnvModule,
  publicVariables,
  refusedModule,
  serverOnlyModule
} from "./envModules.ts";
import type { KitProject } from "./kitProject.ts";
import { projectRoutes, projectStaticFiles } from "./projectFiles.ts";

/** The modules a story gets Forgebook's stand-in for, by the stand-in's export of this package. */
const STAND_INS: Readonly<Record<string, string>> = {
  "$app/env": "app/env",
  "$app/environment": "app/env",
  "$app/forms": "app/forms",
  "$app/manifest": "app/manifest",
  "$app/navigation": "app/navigation",
  "$app/paths": "app/paths",
  "$app/state": "app/state",
  "$app/stores": "app/stores"
};

/** The prefix of the modules this plugin writes. */
const VIRTUAL = "\0forgebook-sveltekit:";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A text of SvelteKit's options, or a default.
 *
 * @param options - an object of the options.
 * @param key - its key.
 * @param fallback - the default.
 */
const textOption = (options: unknown, key: string, fallback: string): string => {
  const value = isRecord(options) ? options[key] : undefined;
  return typeof value === "string" ? value : fallback;
};

/**
 * A text written as a regular expression that matches it alone.
 *
 * @param name - the text.
 */
const exactly = (name: string): RegExp => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`);

/**
 * A module this package exports, as a file.
 *
 * @param subpath - the export (`app/state`).
 */
const ownExport = (subpath: string): string =>
  fileURLToPath(import.meta.resolve(`@forgebook/sveltekit/${subpath}`));

/**
 * The aliases of SvelteKit's `alias` option and of `$lib`, as SvelteKit writes them: a name for itself and what is
 * below it, a name ending in `/*` for what is below it. Each leads to a path in Vite's form, with forward slashes on
 * every system: what a name leads to is written after it (`$lib/site` to `<lib>/site`), so a Windows path would come
 * out half in backslashes.
 *
 * @param project - the project.
 * @param paths - the system's path functions; the running system's by default.
 */
export const projectAliases = (
  project: Pick<KitProject, "kit" | "dir">,
  paths: VitePaths = VITE_PATHS
): Alias[] => {
  const { kit, dir } = project;
  const files = isRecord(kit["files"]) ? kit["files"] : {};
  const aliases: [string, string][] = [
    // SvelteKit 3 has no `$lib`, which a project's own `#lib` import replaces: giving it costs nothing
    ["$lib", textOption(files, "lib", "src/lib")],
    ...(isRecord(kit["alias"])
      ? Object.entries(kit["alias"]).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      : [])
  ];
  return aliases.flatMap(([name, target]): Alias[] => {
    const path = paths.isAbsolute(target) ? paths.normalize(target) : paths.resolve(dir, target);
    if (name.endsWith("/*")) {
      const prefix = name.slice(0, -2);
      return [
        {
          find: new RegExp(`^${exactly(prefix).source.slice(1, -1)}/`),
          replacement: `${path.replace(/\/\*$/, "")}/`
        }
      ];
    }
    return [
      { find: exactly(name), replacement: path },
      { find: new RegExp(`^${exactly(name).source.slice(1, -1)}/`), replacement: `${path}/` }
    ];
  });
};

/**
 * Why a public environment module is not this SvelteKit's: each has its own, and the other's does not exist, so it
 * gives nothing (SvelteKit 3 gives no variable by its prefix alone).
 *
 * @param module - the module.
 * @param version - the project's SvelteKit.
 * @returns the reason, or none for one of this SvelteKit's.
 */
const otherKitsModule = (module: PublicEnvModule, version: 2 | 3): string | undefined => {
  if (module === "$app/env/public")
    return version === 2
      ? `${module} is SvelteKit 3's: SvelteKit 2 gives the public variables through $env/static/public and $env/dynamic/public`
      : undefined;
  return version === 3
    ? `${module} is SvelteKit 2's: SvelteKit 3 gives the variables src/env.ts declares public through $app/env/public`
    : undefined;
};

/**
 * The `.env` files Vite reads for a mode that exist, so an edit to one writes the environment modules again.
 *
 * @param envDir - the folder they are in.
 * @param mode - the mode.
 */
const envFiles = (envDir: string, mode: string): string[] =>
  [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`]
    .map((name) => join(envDir, name))
    // a missing one is not watched: Vite would take it for an import the module makes
    .filter((file) => existsSync(file));

/**
 * The script the frame's page runs before any module: the settings the stand-ins read. Set inline in the page, so
 * every value is a `codeLiteral`: no text in it can close the script.
 *
 * @param settings - the settings.
 */
export const pageScript = (settings: KitAppSettings): string =>
  `globalThis[Symbol.for(${codeLiteral(APP_SETTINGS_KEY)})] = ${codeLiteral(settings)};`;

/**
 * The plugin of a SvelteKit catalogue.
 *
 * @param project - the project, read.
 * @returns the plugin.
 */
export const kitPlugin = (project: KitProject): Plugin => {
  const { kit, dir } = project;
  const files = isRecord(kit["files"]) ? kit["files"] : {};
  const paths = isRecord(kit["paths"]) ? kit["paths"] : {};
  const env = isRecord(kit["env"]) ? kit["env"] : {};
  const srcDir = resolve(dir, textOption(files, "src", "src"));
  const routesDir = resolve(
    dir,
    textOption(files, "routes", join(textOption(files, "src", "src"), "routes"))
  );
  const staticDir = resolve(dir, textOption(files, "assets", "static"));
  const { extensions, version } = project;
  let resolved: ResolvedConfig | undefined;
  let settings: KitAppSettings | undefined;
  const settingsNow = (): KitAppSettings => {
    settings ??= {
      base: textOption(paths, "base", ""),
      assets: textOption(paths, "assets", ""),
      version: textOption(kit["version"], "name", ""),
      routes: projectRoutes(routesDir, extensions),
      staticFiles: projectStaticFiles(staticDir)
    };
    return settings;
  };
  const allVariables = (): Record<string, string> =>
    resolved === undefined ? {} : loadEnv(resolved.mode, resolve(dir, textOption(env, "dir", ".")), "");
  /**
   * A public environment module: the variables this SvelteKit gives the browser, or a refusal for the other's module.
   *
   * @param name - the module's name, with the names it is imported with.
   * @param module - the module.
   * @param watch - adds a file whose edit writes the module again.
   */
  const publicEnvModule = async (
    name: string,
    module: PublicEnvModule,
    watch: (file: string) => void
  ): Promise<string> => {
    const refusal = otherKitsModule(module, version);
    if (refusal !== undefined) return refusedModule(name, refusal);
    for (const file of envFiles(resolve(dir, textOption(env, "dir", ".")), resolved?.mode ?? "development"))
      watch(file);
    const variables = allVariables();
    if (module === "$app/env/public") {
      const declared = await declaredPublicVariables(srcDir, variables, projectAliases(project));
      if (declared === undefined) return "";
      watch(declared.file);
      return namedExports(declared.values);
    }
    const values = publicVariables(
      variables,
      textOption(env, "publicPrefix", "PUBLIC_"),
      textOption(env, "privatePrefix", "")
    );
    return module === "$env/static/public"
      ? namedExports(values)
      : `export const env = ${codeLiteral(values)};\n`;
  };
  return {
    name: "forgebook:sveltekit",
    enforce: "pre",
    config: (): UserConfig => ({
      // a server render has no page to write the settings in: the code this package compiles has them instead
      define: { [SETTINGS_CONSTANT]: codeLiteral(settingsNow()) },
      // compiled by Vite, so the settings are in it, rather than loaded by Node as it is published
      ssr: { noExternal: ["@forgebook/sveltekit"] },
      resolve: {
        alias: [
          ...Object.entries(STAND_INS).map(([name, subpath]) => ({
            find: exactly(name),
            replacement: ownExport(subpath)
          })),
          ...projectAliases(project)
        ]
      }
    }),
    configResolved: (config: ResolvedConfig): void => {
      resolved = config;
      if (project.problem !== undefined) config.logger.warn(`[forgebook] ${project.problem}`);
    },
    configureServer: (server: ViteDevServer): void => {
      // a route or a static file added or removed is in the next frame's settings
      const renew = (path: string): void => {
        if (path.startsWith(routesDir) || path.startsWith(staticDir)) settings = undefined;
      };
      for (const event of ["add", "unlink", "addDir", "unlinkDir"] as const) server.watcher.on(event, renew);
    },
    transformIndexHtml: (_html: string, context: IndexHtmlTransformContext): HtmlTagDescriptor[] =>
      (context.path.split("?")[0] ?? "").endsWith("frame.html")
        ? [{ tag: "script", children: pageScript(settingsNow()), injectTo: "head-prepend" }]
        : [],
    // an import of a server-only module names what it imports, so the module that refuses to load can declare it
    transform: {
      filter: { code: /\$(app|env|service-worker)/ },
      handler: (code: string): { code: string; map: null } | undefined => {
        const rewritten = namedServerImports(code);
        return rewritten === undefined ? undefined : { code: rewritten, map: null };
      }
    },
    resolveId: (source: string): string | undefined =>
      kitModuleName(source) === undefined ? undefined : `${VIRTUAL}${source}`,
    async load(id: string): Promise<string | undefined> {
      if (!id.startsWith(VIRTUAL)) return undefined;
      const name = id.slice(VIRTUAL.length);
      if (isServerOnly(name)) return serverOnlyModule(name);
      const module = PUBLIC_ENV.find((known): known is PublicEnvModule => known === kitModuleName(name));
      if (module === undefined) return undefined;
      return publicEnvModule(name, module, (file: string): void => this.addWatchFile(file));
    }
  };
};
