/**
 * The Vite plugins that let a Next.js project's components draw outside Next.js: its modules resolved to stand-ins
 * that work in a story, its fonts and images loaded as Next.js loads them, its variables, aliases, Sass options and
 * PostCSS read from the project.
 *
 * @remarks
 * What a stand-in replaces and why is in each module of `src/next`. `next/image` is Next.js's own (its stand-in only
 * reads its default export as Next.js's compiler does), and needs only its settings, which Next.js's bundler writes as
 * `process.env.__NEXT_IMAGE_OPTS`: images are drawn as they are (`unoptimized`), since there is no image server,
 * unless `next.config` names a `loaderFile`, whose addresses work from any page. The frame's page gets, before any
 * module, the `process.env` Next.js gives the browser: `NODE_ENV`, the `NEXT_PUBLIC_` variables of the environment and
 * the `.env` files, `next.config`'s `env`. Nothing else of the environment reaches the page.
 *
 * @module
 */
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { codeLiteral } from "forgebook/code-literal";
import { type PostcssRunner, projectPostcss, watchedFiles } from "forgebook/vite/project-postcss";
import {
  type ConfigEnv,
  type HtmlTagDescriptor,
  type IndexHtmlTransformContext,
  loadEnv,
  type Plugin,
  type PluginOption,
  type ResolvedConfig,
  type UserConfig
} from "vite";

import { APP_SETTINGS_KEY, type NextAppSettings } from "../appSettings.ts";
import { type FontCall, findFontCalls, replaceFontCalls } from "./fonts/fontCalls.ts";
import { buildFontModule, shortHash } from "./fonts/fontModule.ts";
import { loadNextConfig, type NextProjectConfig, nextConfigFile } from "./nextConfig.ts";
import type { NextjsOptions } from "./nextjs.ts";
import { staticImages } from "./staticImages.ts";

/** The modules a story gets Forgebook's stand-in for, by the stand-in's export of this package. */
const STAND_INS: Readonly<Record<string, string>> = {
  "next/cache": "next/cache",
  "next/config": "next/config",
  "next/dynamic": "next/dynamic",
  "next/form": "next/form",
  "next/head": "next/head",
  "next/headers": "next/headers",
  "next/image": "next/image",
  "next/legacy/image": "next/legacy-image",
  "next/link": "next/link",
  "next/navigation": "next/navigation",
  "next/router": "next/router",
  "next/script": "next/script",
  "server-only": "next/empty",
  "client-only": "next/empty"
};

/** The module Next.js's image component takes its default loader from, replaced by a project's `loaderFile`. */
const IMAGE_LOADER = "next/dist/shared/lib/image-loader";

/** A module whose `next/font` calls are rewritten. */
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

/** A style sheet PostCSS runs on: plain CSS, a CSS module among them; Sass compiles its own first. */
const CSS_FILE = /\.css(\?.*)?$/;

/** A module that calls `next/font`. */
const FONT_IMPORT = /(?:@next|next)\/font\/(?:google|local)/;

/** The prefix of a font's module, as the rewritten code imports it. */
const FONT_MODULE = "virtual:forgebook-next-font/";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A regular expression matching a module name exactly, with or without `.js`.
 *
 * @param name - the module name.
 */
const exactly = (name: string): RegExp =>
  new RegExp(`^${name.replaceAll("/", "\\/").replaceAll(".", "\\.")}(\\.js)?$`);

/**
 * The file of one of this package's exports.
 *
 * @param subpath - the export (`next/link`).
 */
const ownExport = (subpath: string): string =>
  fileURLToPath(import.meta.resolve(`@forgebook/nextjs/${subpath}`));

/**
 * Sass's options from `next.config`'s `sassOptions`: Next.js's legacy names (`includePaths`, `prependData`) written as
 * the modern compiler names them.
 *
 * @param sassOptions - `next.config`'s `sassOptions`.
 */
export const sassPreprocessorOptions = (
  sassOptions: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  const {
    includePaths,
    loadPaths,
    prependData,
    additionalData,
    implementation: _implementation,
    ...rest
  } = sassOptions;
  const paths = [includePaths, loadPaths].flatMap((value) =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
  );
  const data = additionalData ?? prependData;
  return {
    ...rest,
    ...(paths.length === 0 ? {} : { loadPaths: paths }),
    ...(typeof data === "string" ? { additionalData: data } : {})
  };
};

/**
 * Next.js's image settings for the page: its defaults (from the project's `next`), `next.config`'s, and drawn as they
 * are unless a `loaderFile` gives the addresses.
 *
 * @param dir - the project's folder.
 * @param images - `next.config`'s `images`.
 */
export const imageSettings = (
  dir: string,
  images: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  let defaults: unknown;
  try {
    const require = createRequire(join(dir, "package.json"));
    const config: unknown = require("next/dist/shared/lib/image-config.js");
    defaults = isRecord(config) ? config["imageConfigDefault"] : undefined;
  } catch {
    defaults = undefined;
  }
  // the loader file is an alias of the build (`IMAGE_LOADER`): its path, which may be a folder of the machine, stays
  // out of the page
  const { loaderFile, ...shown } = images;
  return {
    ...(isRecord(defaults) ? defaults : {}),
    ...shown,
    loaderFile: "",
    ...(typeof loaderFile === "string" ? { loader: "custom" } : { unoptimized: true })
  };
};

/**
 * The script the frame's page runs before any module: the `process.env` Next.js gives the browser, and the settings
 * the stand-ins read. Set inline in the page, so every value is a `codeLiteral`: no text in it can close the script.
 *
 * @param env - the variables, by name.
 * @param settings - the settings.
 */
export const pageScript = (env: Readonly<Record<string, unknown>>, settings: NextAppSettings): string =>
  [
    "globalThis.process ??= { env: {} };",
    "globalThis.process.env ??= {};",
    `Object.assign(globalThis.process.env, ${codeLiteral(env)});`,
    `globalThis[Symbol.for(${codeLiteral(APP_SETTINGS_KEY)})] = ${codeLiteral(settings)};`
  ].join("\n");

/**
 * The plugins of a Next.js catalogue.
 *
 * @param options - the options of `nextjs()`.
 * @returns the plugins.
 */
export const nextPlugins = (options: NextjsOptions = {}): PluginOption[] => {
  let dir = process.cwd();
  let next: NextProjectConfig | undefined;
  let resolved: ResolvedConfig | undefined;
  let configProblem: string | undefined;
  const fonts = new Map<string, { readonly call: FontCall; readonly importer: string }>();
  const warned = new Set<string>();
  let googleData: unknown;
  const main: Plugin = {
    name: "forgebook:nextjs",
    enforce: "pre",
    config: async (userConfig: UserConfig, environment: ConfigEnv): Promise<UserConfig> => {
      dir = resolve(userConfig.root ?? process.cwd(), options.dir ?? ".");
      const file = options.nextConfig === false ? undefined : nextConfigFile(dir, options.nextConfig);
      const phase = environment.command === "build" ? "phase-production-build" : "phase-development-server";
      const loaded = await loadNextConfig(file, phase);
      next = loaded.config;
      configProblem = loaded.problem;
      const loaderFile = next.images["loaderFile"];
      const sass = sassPreprocessorOptions(next.sassOptions);
      return {
        // `next.config`'s `env` is written into the code that reads it, as Next.js does: a value no browser code reads
        // never reaches a page
        define: Object.fromEntries(
          Object.entries(next.env).map(([name, value]) => [`process.env.${name}`, codeLiteral(value)])
        ),
        resolve: {
          // `@/components/…`: the paths of the project's tsconfig.json, as Next.js reads them
          tsconfigPaths: true,
          alias: [
            ...Object.entries(STAND_INS).map(([name, subpath]) => ({
              find: exactly(name),
              replacement: ownExport(subpath)
            })),
            ...(typeof loaderFile === "string"
              ? [{ find: exactly(IMAGE_LOADER), replacement: resolve(dir, loaderFile) }]
              : [])
          ]
        },
        ...(Object.keys(sass).length === 0
          ? {}
          : { css: { preprocessorOptions: { scss: sass, sass: { ...sass } } } })
      };
    },
    configResolved: (config: ResolvedConfig): void => {
      resolved = config;
      if (configProblem !== undefined) config.logger.warn(`[forgebook] ${configProblem}`);
      try {
        googleData = createRequire(join(dir, "package.json"))(
          "next/dist/compiled/@next/font/dist/google/font-data.json"
        );
      } catch {
        googleData = undefined;
      }
    },
    transformIndexHtml: (_html: string, context: IndexHtmlTransformContext): HtmlTagDescriptor[] => {
      if (
        !(context.path.split("?")[0] ?? "").endsWith("frame.html") ||
        resolved === undefined ||
        next === undefined
      )
        return [];
      // `envDir: false` turns variables off, as it does for Vite's own
      const publicEnv =
        resolved.envDir === false ? {} : loadEnv(resolved.mode, resolved.envDir ?? dir, "NEXT_PUBLIC_");
      const env = {
        ...publicEnv,
        // the names Next.js gives them in the browser's code
        ["NODE_ENV"]: resolved.isProduction ? "production" : "development",
        ["__NEXT_IMAGE_OPTS"]: imageSettings(dir, next.images)
      };
      const settings: NextAppSettings = {
        basePath: next.basePath,
        publicRuntimeConfig: next.publicRuntimeConfig
      };
      return [{ tag: "script", children: pageScript(env, settings), injectTo: "head-prepend" }];
    },
    transform: {
      filter: { id: SCRIPT_FILE, code: FONT_IMPORT },
      handler(code: string, id: string): { code: string; map: null } | undefined {
        if (id.includes("/node_modules/")) return undefined;
        const found = findFontCalls(code, id);
        for (const problem of found.problems) this.warn(`${id}: ${problem}`);
        if (found.calls.length === 0) return undefined;
        const ids = found.calls.map((call) => {
          const key = shortHash(JSON.stringify([id, call.start, call.loader, call.family, call.options]));
          fonts.set(key, { call, importer: id });
          return `${FONT_MODULE}${key}`;
        });
        return { code: replaceFontCalls(code, found, ids), map: null };
      }
    },
    resolveId: {
      filter: { id: new RegExp(`^${FONT_MODULE}`) },
      handler: (source: string): string => `\0${source}`
    },
    load: {
      filter: { id: new RegExp(`^\\0${FONT_MODULE}`) },
      async handler(id: string): Promise<string | undefined> {
        const font = fonts.get(id.slice(FONT_MODULE.length + 1));
        if (font === undefined || resolved === undefined) return undefined;
        const built = await buildFontModule(font.call, font.importer, {
          cacheDir: join(resolved.cacheDir, "forgebook-next-font"),
          googleData,
          googleFonts: options.googleFonts ?? "download",
          fetcher: fetch,
          warn: (message: string): void => {
            if (warned.has(message)) return;
            warned.add(message);
            this.warn(message);
          }
        });
        for (const file of built.watch) this.addWatchFile(file);
        return built.code;
      }
    }
  };
  let runPostcss: PostcssRunner | undefined;
  const postcss: Plugin = {
    name: "forgebook:next-postcss",
    enforce: "pre",
    configResolved: (): void => {
      runPostcss = projectPostcss(dir, { bringsPostcss: "next" });
    },
    transform: {
      filter: { id: CSS_FILE },
      async handler(code: string, id: string): Promise<{ code: string; map: null } | undefined> {
        // `?raw` and `?url` imports are JavaScript by then, which Vite's own CSS pipeline leaves alone too
        if (runPostcss === undefined || /[?&](raw|url)\b/.test(id)) return undefined;
        const file = id.split("?")[0] ?? id;
        const result = await runPostcss(code, file);
        // the files a plugin read (Tailwind CSS reads the components for their classes) renew the style sheet
        for (const watched of watchedFiles(result.messages)) this.addWatchFile(watched);
        return { code: result.css, map: null };
      }
    }
  };
  return [main, staticImages(), postcss];
};
