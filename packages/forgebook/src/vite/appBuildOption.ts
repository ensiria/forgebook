/**
 * The `appBuild` option of a catalogue's configuration: how much of the app's own build its stories are drawn with,
 * checked and resolved.
 *
 * @remarks
 * A catalogue is its own Vite project, so what the app's build does for its components (aliases, Tailwind, PostCSS, its
 * Vite plugins) has to be read from the app, or every story is told apart from the app by what it lacks. All of it is on
 * by default, and each part can be turned off here. The command that reads the parts is `bin/forgebook/appBuild`.
 *
 * @module
 */

/** How much of the app's build a catalogue reads, as `forgebook.config.ts` writes it. */
export type AppBuildOption =
  | false
  | {
      /**
       * The app's Vite configuration, by path from the catalogue's folder; the `vite.config` beside the catalogue's by
       * default. It is loaded as `vite dev` loads it, which runs its code and that of the plugins it makes. `false` reads
       * none.
       */
      readonly viteConfig?: string | false;
      /** Whether to read `paths` from `tsconfig.json`, which runs nothing; `true` by default. */
      readonly tsconfigPaths?: boolean;
      /** Whether to run the project's `postcss.config`, which runs its code and its plugins'; `true` by default. */
      readonly postcss?: boolean;
      /** The names of the app's Vite plugins to leave out, for one that only an app's build needs. */
      readonly skipPlugins?: readonly string[];
      /** The names of the app's Vite plugins to keep although Forgebook leaves them out by default. */
      readonly keepPlugins?: readonly string[];
    };

/** The `appBuild` option, resolved. */
export type ResolvedAppBuild = {
  /** The app's Vite configuration by its path from the catalogue's folder, the one found when none, or `false`. */
  readonly viteConfig: string | false | undefined;
  /** Whether `tsconfig.json`'s `paths` are read. */
  readonly tsconfigPaths: boolean;
  /** Whether the project's PostCSS runs. */
  readonly postcss: boolean;
  /** The names of the app's plugins to leave out. */
  readonly skipPlugins: readonly string[];
  /** The names of the app's plugins to keep whatever the default says. */
  readonly keepPlugins: readonly string[];
};

/** Whether a value is a list of texts. */
const isTextList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

/**
 * Why an `appBuild` option cannot be used, or none.
 *
 * @param value - the option, as the configuration gives it.
 */
export const appBuildProblem = (value: unknown): string | undefined => {
  if (value === undefined || value === false) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return "`appBuild` is false or `{ viteConfig, tsconfigPaths, postcss, skipPlugins, keepPlugins }`";
  const fields = new Map(Object.entries(value));
  const viteConfig = fields.get("viteConfig");
  if (viteConfig !== undefined && viteConfig !== false && typeof viteConfig !== "string")
    return "`appBuild.viteConfig` is a path or false";
  for (const key of ["tsconfigPaths", "postcss"]) {
    const field = fields.get(key);
    if (field !== undefined && typeof field !== "boolean") return `\`appBuild.${key}\` is true or false`;
  }
  for (const key of ["skipPlugins", "keepPlugins"]) {
    const field = fields.get(key);
    if (field !== undefined && !isTextList(field)) return `\`appBuild.${key}\` is a list of plugin names`;
  }
  return undefined;
};

/**
 * The `appBuild` option, resolved.
 *
 * @param option - the option, checked by `appBuildProblem`.
 */
export const resolvedAppBuild = (option: AppBuildOption | undefined): ResolvedAppBuild =>
  option === false
    ? { viteConfig: false, tsconfigPaths: false, postcss: false, skipPlugins: [], keepPlugins: [] }
    : {
        viteConfig: option?.viteConfig,
        tsconfigPaths: option?.tsconfigPaths ?? true,
        postcss: option?.postcss ?? true,
        skipPlugins: option?.skipPlugins ?? [],
        keepPlugins: option?.keepPlugins ?? []
      };
