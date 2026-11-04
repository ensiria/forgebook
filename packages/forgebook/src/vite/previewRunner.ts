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
 * container, a decorator) or called (an addon's factory in `definePreview`), and what a call made can be looked into
 * as the framework composing the preview does; but reading a property of an export, using any placeholder as a
 * string, a number or a list, or listing the names of the namespace throws, naming the package: a preview that uses
 * such a package while it loads still fails to load, and is named among the answers' problems, rather than giving
 * values a browser would not. A placeholder kept in the preview's args or parameters is left out of the answers, as a
 * function is. A file of the catalogue's own that reads a browser global is not replaced: half run, it would leave
 * values a browser does not have.
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
 * What a script reads of a value to use it as data: to turn it into a string or a number (`${value}`, `value + 1`), and
 * to iterate it (`[...value]`, `for of`, `for await`). A placeholder has no such value, so reading these throws.
 */
const VALUE_SYMBOLS: ReadonlySet<symbol> = new Set([
  Symbol.toPrimitive,
  Symbol.iterator,
  Symbol.asyncIterator
]);

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
 * How many calls and reads a chain may take from an export: far more than a framework's composition needs (Storybook's
 * takes three, `docs().default.parameters`), and a bound on a loop that walks a placeholder (`while (node.parent)`),
 * which would otherwise never end and hold the dev server with it.
 */
const MAX_STEPS = 16;

/**
 * An export of a package that did not load on Node, or what a call of one made: a function that can be kept and called
 * (what it returns is another), and throws when it is constructed or used as data (made a string or a number, or
 * iterated).
 *
 * @remarks
 * A property read differs by origin. Of an export, it throws: the preview's own code reads a value of the package
 * (`themes.light`), which a browser would give and a placeholder cannot. Of what a call made, it is a placeholder too,
 * the same one each time it is read: what a factory returns is handed whole to the framework that composes the
 * preview, which looks into it for what it contributes (Storybook's `definePreview` reads
 * `addon.default?.parameters ?? addon.parameters` of every addon in `addons: [docs()]`), keeps what it finds, or merges
 * it with `Object.assign`, which finds no names on a placeholder. So the composition runs to its end, its values from
 * the package being placeholders, while a string, a number or a list taken from them still throws.
 *
 * @param name - the export, and what was done with it (`docs().default`).
 * @param file - the package's module.
 * @param reason - why the module did not load.
 * @param steps - the calls and reads from the export to this placeholder: none for the export itself.
 */
const placeholder = (name: string, file: string, reason: string, steps: number): unknown => {
  const read = new Map<string, unknown>();
  // the next placeholder of the chain, or why it goes no further
  const next = (step: string): unknown => {
    if (steps >= MAX_STEPS) throw unavailable(step, file, reason);
    return placeholder(step, file, reason, steps + 1);
  };
  // a class, not an arrow function: `new` reaches the trap of a constructor only, and its message names the package
  const target = class {};
  const proxy = new Proxy(target, {
    apply: (): unknown => next(`${name}()`),
    construct: (): object => {
      throw unavailable(`new ${name}`, file, reason);
    },
    get: (self: object, key: string | symbol, receiver: unknown): unknown => {
      if (typeof key === "symbol") {
        if (VALUE_SYMBOLS.has(key)) throw unavailable(name, file, reason);
        return Reflect.get(self, key, receiver);
      }
      if (FUNCTION_KEYS.has(key)) return Reflect.get(self, key, receiver);
      if (ABSENT_KEYS.has(key)) return undefined;
      if (steps === 0) throw unavailable(`${name}.${key}`, file, reason);
      if (!read.has(key)) read.set(key, next(`${name}.${key}`));
      return read.get(key);
    }
  });
  // the class's prototype leads back to the placeholder, not to a constructor that would make a plain object
  target.prototype.constructor = proxy;
  return proxy;
};

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
      typeof key === "string" && !ABSENT_KEYS.has(key) ? placeholder(key, file, reason, 0) : undefined,
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
