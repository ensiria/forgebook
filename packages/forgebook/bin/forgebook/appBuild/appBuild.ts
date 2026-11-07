/**
 * The app's own build, as a catalogue draws its stories with it: the Vite plugins that give the catalogue the project's
 * `tsconfig` paths, what its `vite.config` keeps, and its PostCSS.
 *
 * @remarks
 * A project with none of these pays a few file checks, and nothing is imported. A framework whose adapter reads a part
 * itself keeps doing so: Next.js has no Vite configuration and runs PostCSS itself, Nuxt and SvelteKit bring their
 * aliases from their own configuration, SvelteKit reads its `vite.config` for its options, and React Native runs its
 * own PostCSS. What could not be read never stops a catalogue: the stories that do not need it still draw, and each
 * problem is said once with what to do.
 *
 * @module
 */
import { relative } from "node:path";

import type { ConfigEnv, Plugin, PluginOption, ResolvedConfig as ResolvedViteConfig } from "vite";

import type { ResolvedConfig } from "../../../src/vite/configFile.ts";
import {
  PostcssConfigError,
  type Processed,
  postcssConfigPlace,
  projectPostcss,
  watchedFiles
} from "../../../src/vite/projectPostcss.ts";
import { type AppViteConfig, isWorthLoading, loadAppViteConfig, viteConfigFile } from "./appViteConfig.ts";
import { hasTsconfigPaths } from "./tsconfigPaths.ts";

/** The parts of an app's build a catalogue can read. */
type AppBuildPart = "vite-config" | "postcss" | "tsconfig-paths";

/** What each framework's adapter reads itself, by the adapter's name. */
const READ_BY_ADAPTER: Readonly<Record<string, readonly AppBuildPart[]>> = {
  nextjs: ["vite-config", "postcss", "tsconfig-paths"],
  nuxt: ["vite-config", "tsconfig-paths"],
  sveltekit: ["vite-config"],
  angular: ["vite-config"],
  "react-native-web": ["postcss"]
};

/** A style sheet PostCSS runs on: plain CSS, a component's style block among them; Sass compiles its own first. */
const CSS_FILE = /\.(?:css|pcss|postcss)(?:\?.*)?$/;

/** A style sheet's imports that are not compiled, which Vite's own CSS pipeline leaves alone too. */
const NOT_COMPILED = /[?&](?:raw|url)\b/;

/** What a catalogue read of the app's build, for the line it prints and for tools. */
export type AppBuildReport = {
  /** The Vite configuration it loaded, from the catalogue's folder; none when it loaded none. */
  readonly viteConfig: string | undefined;
  /** The names of the plugins of it the catalogue runs. */
  readonly plugins: readonly string[];
  /** The names of the plugins of it the catalogue leaves out. */
  readonly leftOutPlugins: readonly string[];
  /** Whether `tsconfig.json`'s `paths` are read. */
  readonly tsconfigPaths: boolean;
  /** Whether the project's PostCSS runs. */
  readonly postcss: boolean;
  /** What could not be read, each with what to do. */
  readonly problems: readonly string[];
};

/** A catalogue's Vite plugins for the app's build, and what they read. */
export type AppBuild = {
  /** The plugins; none for a project with nothing to read. */
  readonly plugins: readonly PluginOption[];
  /** What they read. */
  readonly report: AppBuildReport;
};

/**
 * The plugin that runs the project's PostCSS before Lightning CSS.
 *
 * @param dir - the catalogue's folder.
 * @param inlinePlugins - what the app's `css.postcss` makes; the project's file is read when none.
 * @returns the plugin, or none for a project with no PostCSS.
 */
const postcssPlugin = (dir: string, inlinePlugins: readonly unknown[] | undefined): Plugin | undefined => {
  const run = projectPostcss(dir, inlinePlugins === undefined ? {} : { plugins: inlinePlugins });
  if (run === undefined) return undefined;
  let isSaid = false;
  return {
    name: "forgebook:app-postcss",
    enforce: "pre",
    transform: {
      filter: { id: CSS_FILE },
      async handler(code: string, id: string): Promise<{ code: string; map: null } | undefined> {
        if (NOT_COMPILED.test(id)) return undefined;
        let result: Processed;
        try {
          result = await run(code, id.split("?")[0] ?? id);
        } catch (error) {
          if (!(error instanceof PostcssConfigError)) throw error;
          if (!isSaid)
            this.warn(
              `The project's PostCSS could not be loaded: ${error.message}. Set appBuild: { postcss: false } to leave it out`
            );
          isSaid = true;
          return undefined;
        }
        // the files a plugin read (Tailwind CSS reads the components for their classes) renew the style sheet
        for (const watched of watchedFiles(result.messages)) this.addWatchFile(watched);
        return { code: result.css, map: null };
      }
    }
  };
};

/**
 * The sentence for a Vite configuration that did not load.
 *
 * @param file - the file.
 * @param error - what it threw.
 */
export const viteConfigProblem = (file: string, error: unknown): string =>
  `${file} could not be loaded, so its aliases and plugins are not in the catalogue: ${
    error instanceof Error ? error.message.split("\n")[0] : String(error)
  }. Fix it, or set \`appBuild: { viteConfig: false }\` in the catalogue's configuration`;

/** The line a catalogue prints of what it read; none when it read nothing. */
export const appBuildLine = (report: AppBuildReport): string | undefined => {
  const parts = [
    ...(report.viteConfig === undefined
      ? []
      : [`${report.viteConfig}${report.plugins.length === 0 ? "" : ` (${report.plugins.join(", ")})`}`]),
    ...(report.tsconfigPaths ? ["tsconfig paths"] : []),
    ...(report.postcss ? ["PostCSS"] : [])
  ];
  return parts.length === 0 ? undefined : `Drawing with the app's build: ${parts.join(", ")}`;
};

/** What a catalogue will read of a project's build, as a command that runs none of it tells. */
export type AppBuildPlan = {
  /** The Vite configuration it will load, from the project's folder; none when there is nothing to load. */
  readonly viteConfig: string | undefined;
  /** Whether it will read `tsconfig.json`'s `paths`, which runs nothing. */
  readonly tsconfigPaths: boolean;
  /** The PostCSS configuration it will run, as a path; none when there is none. */
  readonly postcss: string | undefined;
  /** The files whose code runs when the catalogue starts, from the project's folder. */
  readonly runsCode: readonly string[];
};

/**
 * What a catalogue will read of a project's build, from the files alone: nothing here runs any of it.
 *
 * @param dir - the project's folder.
 * @param framework - the adapter's name.
 */
export const appBuildPlan = (dir: string, framework: string): AppBuildPlan => {
  const readByAdapter = READ_BY_ADAPTER[framework] ?? [];
  const file = readByAdapter.includes("vite-config") ? undefined : viteConfigFile(dir, undefined);
  const viteConfig = file !== undefined && isWorthLoading(dir, file) ? file : undefined;
  const place = readByAdapter.includes("postcss") ? undefined : postcssConfigPlace(dir);
  const postcss = place === undefined ? undefined : relative(dir, place.file);
  return {
    viteConfig,
    tsconfigPaths: !readByAdapter.includes("tsconfig-paths") && hasTsconfigPaths(dir),
    postcss,
    // a JSON file too: the plugins it names run, and a path in it can name a file of the project's
    runsCode: [...(viteConfig === undefined ? [] : [viteConfig]), ...(postcss === undefined ? [] : [postcss])]
  };
};

/**
 * The plugin that gives Vite what was read, and says what it read and what it could not.
 *
 * @param fields - what the app's configuration keeps, and the `paths` reading.
 * @param report - what was read.
 */
const settingsPlugin = (fields: AppViteConfig["fields"], report: AppBuildReport): Plugin => ({
  name: "forgebook:app-build",
  config: (): AppViteConfig["fields"] => fields,
  configResolved: (resolved: ResolvedViteConfig): void => {
    const line = appBuildLine(report);
    if (line !== undefined) resolved.logger.info(`[forgebook] ${line}`);
    // an error's level: a command's server logs nothing less, and the run must not pass this over in silence
    for (const problem of report.problems) resolved.logger.error(`[forgebook] ${problem}`);
  }
});

/**
 * Loads the app's Vite configuration, when the catalogue reads it and it has something to give.
 *
 * @param config - the catalogue's configuration, read.
 * @param environment - the command and the mode the catalogue runs for.
 * @param isReadingPaths - whether Vite reads `tsconfig` paths here.
 * @param isOneShot - whether the server is a one-shot command's.
 * @returns what it gives; why it could not be loaded.
 */
const appViteConfigOf = async (
  config: ResolvedConfig,
  environment: ConfigEnv,
  isReadingPaths: boolean,
  isOneShot: boolean
): Promise<{ readonly app?: AppViteConfig; readonly problem?: string }> => {
  const isOwn = READ_BY_ADAPTER[config.framework.name]?.includes("vite-config") === true;
  const file = isOwn ? undefined : viteConfigFile(config.dir, config.appBuild.viteConfig);
  if (file === undefined || !isWorthLoading(config.dir, file)) return {};
  try {
    return {
      app: await loadAppViteConfig(
        config.dir,
        file,
        environment,
        config.framework.name,
        config.appBuild,
        isReadingPaths,
        isOneShot
      )
    };
  } catch (error) {
    return { problem: viteConfigProblem(file, error) };
  }
};

/**
 * What a catalogue reads of the app's build.
 *
 * @param config - the catalogue's configuration, read.
 * @param environment - the command and the mode the catalogue runs for.
 * @param isOneShot - whether the server is a one-shot command's, which leaves out the plugins' `configureServer`.
 */
export const appBuildOf = async (
  config: ResolvedConfig,
  environment: ConfigEnv,
  isOneShot = false
): Promise<AppBuild> => {
  const options = config.appBuild;
  const readByAdapter = READ_BY_ADAPTER[config.framework.name] ?? [];
  const tsconfigPaths =
    options.tsconfigPaths && !readByAdapter.includes("tsconfig-paths") && hasTsconfigPaths(config.dir);
  const { app, problem } = await appViteConfigOf(config, environment, tsconfigPaths, isOneShot);
  const postcss =
    options.postcss && !readByAdapter.includes("postcss")
      ? postcssPlugin(config.dir, app?.postcssPlugins)
      : undefined;
  const report: AppBuildReport = {
    viteConfig: app?.file,
    plugins: (app?.plugins ?? []).map((plugin) => plugin.name),
    leftOutPlugins: app?.leftOut ?? [],
    tsconfigPaths,
    postcss: postcss !== undefined,
    problems: [...(problem === undefined ? [] : [problem]), ...(app?.notes ?? [])]
  };
  const fields = app?.fields ?? {};
  const settings = tsconfigPaths
    ? { ...fields, resolve: { ...fields.resolve, tsconfigPaths: true } }
    : fields;
  const isEmpty =
    Object.keys(settings).length === 0 && report.problems.length === 0 && appBuildLine(report) === undefined;
  return {
    plugins: [
      ...(isEmpty ? [] : [settingsPlugin(settings, report)]),
      ...(app?.plugins ?? []),
      ...(postcss === undefined ? [] : [postcss])
    ],
    report
  };
};
