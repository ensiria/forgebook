/**
 * Loads a catalogue's previews on the dev server for tools, with the packages they import that only a browser can run
 * left as placeholders, so their args and parameters are read on Node.
 *
 * @remarks
 * A preview is written for a browser: it imports Storybook's docs blocks for its docs container, or a package that
 * reads `document` while it loads. The server reads only its args, parameters and globals, which rarely come from
 * those, but one such import would leave the whole preview out of every answer. So the previews load in a module
 * runner of their own whose evaluator takes a package (a module Vite leaves to Node) that stops on a browser global
 * (`document is not defined`) for a namespace of placeholders. A placeholder can be kept in a parameter (a docs
 * container, a decorator), but calling one, reading one of its properties or listing the namespace's names throws,
 * naming the package: a preview that uses such a package while it loads still fails to load, and is named among the
 * answers' problems, rather than giving values a browser would not. A file of the catalogue's own that reads a browser
 * global is not replaced: half run, it would leave values a browser does not have.
 *
 * The runner is Vite's (`createServerModuleRunner`, experimental in Vite 8), on the server environment, with its hot
 * updates: an edit of a preview or of a file it imports is read on the next answer. One runner serves a dev server
 * for as long as it runs, made on the first preview asked for. Story files are not loaded through it: a story that
 * only a browser can load is a problem of its own story, which the answers name.
 *
 * @module
 */
import { createServerModuleRunner, type DevEnvironment } from "vite";
import { ESModulesEvaluator, type ModuleEvaluator, type ModuleRunner } from "vite/module-runner";

/** The message of a script that read a global its runtime does not have: `document is not defined`. */
const UNDEFINED_GLOBAL = /^(\S+) is not defined$/;

/**
 * The globals a browser has and Node does not, that a package reads while it loads: a missing one of these names a
 * package for browsers, where another missing name is a mistake to report.
 */
const BROWSER_GLOBALS: ReadonlySet<string> = new Set([
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "self",
  "localStorage",
  "sessionStorage",
  "matchMedia",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "customElements",
  "HTMLElement",
  "Element",
  "Node",
  "CSS",
  "CSSStyleSheet",
  "IntersectionObserver",
  "ResizeObserver",
  "MutationObserver"
]);

/**
 * Whether an error is a script reading a global that a browser has and Node does not.
 *
 * @param error - what a module threw while it loaded.
 */
export const isBrowserGlobalError = (error: unknown): error is ReferenceError => {
  if (!(error instanceof ReferenceError)) return false;
  const name = UNDEFINED_GLOBAL.exec(error.message)?.[1];
  return name !== undefined && BROWSER_GLOBALS.has(name);
};

/**
 * What a placeholder or a namespace answers as absent: what `JSON.stringify` and `await` look for, so a parameter that
 * holds one is written without it and a namespace is not taken for a promise.
 */
const ABSENT_KEYS: ReadonlySet<string> = new Set(["toJSON", "then"]);

/** What a placeholder answers as any function does. */
const FUNCTION_KEYS: ReadonlySet<string> = new Set(["name", "length", "prototype", "constructor"]);

/**
 * Why a placeholder cannot be used.
 *
 * @param name - the export, or what was done with it.
 * @param file - the package's module.
 * @param reason - why the module did not load.
 */
const unavailable = (name: string, file: string, reason: string): Error =>
  new Error(`${name} of ${file} cannot be used on the server: it needs a browser (${reason})`);

/**
 * An export of a package that did not load on Node: a function that can be kept, and throws when it is called or a
 * property of it is read.
 *
 * @param name - the export.
 * @param file - the package's module.
 * @param reason - why the module did not load.
 */
const placeholder = (name: string, file: string, reason: string): unknown =>
  new Proxy(() => undefined, {
    apply: (): never => {
      throw unavailable(name, file, reason);
    },
    construct: (): never => {
      throw unavailable(name, file, reason);
    },
    get: (target: () => undefined, key: string | symbol, receiver: unknown): unknown => {
      if (typeof key === "symbol" || FUNCTION_KEYS.has(key)) return Reflect.get(target, key, receiver);
      if (ABSENT_KEYS.has(key)) return undefined;
      throw unavailable(`${name}.${key}`, file, reason);
    }
  });

/**
 * The namespace of a package that did not load on Node: every name it is asked for is a placeholder, so an import of
 * any of them resolves; listing its names throws, since it has none to give.
 *
 * @param file - the package's module.
 * @param reason - why it did not load.
 */
export const browserOnlyNamespace = (file: string, reason: string): object =>
  new Proxy(Object.create(null), {
    has: (_target: object, key: string | symbol): boolean => typeof key === "string" && !ABSENT_KEYS.has(key),
    get: (_target: object, key: string | symbol): unknown =>
      typeof key === "string" && !ABSENT_KEYS.has(key) ? placeholder(key, file, reason) : undefined,
    ownKeys: (): never => {
      throw unavailable("The names", file, reason);
    }
  });

/**
 * An evaluator that runs every module as Vite's does, and takes a package that stops on a browser global for a
 * namespace of placeholders.
 *
 * @param base - the evaluator it wraps.
 */
export const browserTolerantEvaluator = (
  base: ModuleEvaluator = new ESModulesEvaluator()
): ModuleEvaluator => ({
  ...(base.startOffset === undefined ? {} : { startOffset: base.startOffset }),
  runInlinedModule: (...run: Parameters<ModuleEvaluator["runInlinedModule"]>): Promise<unknown> =>
    base.runInlinedModule(...run),
  runExternalModule: async (file: string): Promise<unknown> => {
    try {
      return await base.runExternalModule(file);
    } catch (error) {
      if (!isBrowserGlobalError(error)) throw error;
      return browserOnlyNamespace(file, error.message);
    }
  }
});

/** The runner of each dev server's server environment, made on its first preview. */
const runners = new WeakMap<DevEnvironment, ModuleRunner>();

/**
 * Loads a preview on the server, through the runner of the dev server's server environment.
 *
 * @param environment - the dev server's server environment.
 * @param file - the preview's path.
 * @returns the preview's module.
 */
export const loadPreview = (environment: DevEnvironment, file: string): Promise<unknown> => {
  let runner = runners.get(environment);
  if (runner === undefined) {
    runner = createServerModuleRunner(environment, {
      hmr: { logger: false },
      evaluator: browserTolerantEvaluator()
    });
    runners.set(environment, runner);
  }
  return runner.import(file);
};
