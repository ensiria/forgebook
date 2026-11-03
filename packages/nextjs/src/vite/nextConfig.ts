/**
 * The project's `next.config`, as far as a catalogue reads it: the base path, the variables of `env`, the images'
 * settings, Sass's options and the public runtime configuration.
 *
 * @remarks
 * The file is loaded as Node loads a module (a `next.config.ts` with its types stripped), and a function export is
 * called with the phase, as Next.js calls it; what it returns is read, never trusted: a field of the wrong type is
 * left out. Everything else in it (redirects, headers, webpack, experimental flags) concerns the server or Next.js's
 * own bundler, so a story does not need it. A file that cannot be loaded is a warning, not a failure: the catalogue
 * still opens, without what the file would have given.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** What a catalogue reads of `next.config`. */
export type NextProjectConfig = {
  /** The file read, or none. */
  readonly file: string | undefined;
  /** `basePath`: what Next.js puts before every path of the app; empty by default. */
  readonly basePath: string;
  /** `env`: variables Next.js writes into the browser's code, by name. */
  readonly env: Readonly<Record<string, string>>;
  /** `images`: the image component's settings (`loaderFile`, `deviceSizes`…). */
  readonly images: Readonly<Record<string, unknown>>;
  /** `sassOptions`: Sass's options. */
  readonly sassOptions: Readonly<Record<string, unknown>>;
  /** `publicRuntimeConfig`: what `next/config` returns in the browser (Next.js 15 and before). */
  readonly publicRuntimeConfig: Readonly<Record<string, unknown>>;
};

/** The names `next.config` may have, in the order Next.js looks for them. */
export const NEXT_CONFIG_FILES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "next.config.mts",
  "next.config.cjs"
] as const;

/** Next.js's phases, as a configuration's function receives them. */
type NextPhase = "phase-development-server" | "phase-production-build";

/** A project without `next.config`. */
export const EMPTY_NEXT_CONFIG: NextProjectConfig = {
  file: undefined,
  basePath: "",
  env: {},
  images: {},
  sassOptions: {},
  publicRuntimeConfig: {}
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * An object field of a configuration, or an empty object.
 *
 * @param config - the configuration.
 * @param name - the field.
 */
const objectField = (
  config: Readonly<Record<string, unknown>>,
  name: string
): Readonly<Record<string, unknown>> => {
  const value = config[name];
  return isRecord(value) ? value : {};
};

/**
 * What a catalogue reads of a configuration Next.js would read: each field checked, one of the wrong type left out.
 *
 * @param raw - what the file gave (its default export, called when a function).
 * @param file - the file.
 */
export const readNextConfig = (raw: unknown, file: string | undefined): NextProjectConfig => {
  const config = isRecord(raw) ? raw : {};
  const { basePath } = config;
  return {
    file,
    basePath: typeof basePath === "string" ? basePath.replace(/\/$/, "") : "",
    env: Object.fromEntries(
      Object.entries(objectField(config, "env")).flatMap(([name, value]) =>
        typeof value === "string" ? [[name, value]] : []
      )
    ),
    images: objectField(config, "images"),
    sassOptions: objectField(config, "sassOptions"),
    publicRuntimeConfig: objectField(config, "publicRuntimeConfig")
  };
};

/**
 * The project's `next.config` file: the one given, or the first Next.js would find in the folder.
 *
 * @param dir - the project's folder.
 * @param given - a path from the folder, when the catalogue names one.
 */
export const nextConfigFile = (dir: string, given: string | undefined): string | undefined =>
  given === undefined
    ? NEXT_CONFIG_FILES.map((name) => join(dir, name)).find((file) => existsSync(file))
    : resolve(dir, given);

/**
 * Loads a project's `next.config`.
 *
 * @param file - the file; none for a project without one.
 * @param phase - the phase a function export is called with.
 * @returns what the catalogue reads of it, and why it could not be loaded when it could not.
 */
export const loadNextConfig = async (
  file: string | undefined,
  phase: NextPhase
): Promise<{ readonly config: NextProjectConfig; readonly problem: string | undefined }> => {
  if (file === undefined) return { config: EMPTY_NEXT_CONFIG, problem: undefined };
  try {
    const loaded: unknown = await import(pathToFileURL(file).href);
    const exported = isRecord(loaded) && "default" in loaded ? loaded["default"] : loaded;
    const raw: unknown =
      typeof exported === "function"
        ? await Reflect.apply(exported, undefined, [phase, { defaultConfig: {} }])
        : exported;
    return { config: readNextConfig(raw, file), problem: undefined };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { config: { ...EMPTY_NEXT_CONFIG, file }, problem: `${file} could not be loaded (${reason})` };
  }
};
