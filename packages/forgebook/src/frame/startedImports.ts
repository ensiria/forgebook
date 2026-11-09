/**
 * The dynamic imports a story starts while it is first drawn (a lazy part, an editor's modules, a chart's chunk), which
 * the frame waits for before it says the story is ready: until they settle, the page shows a skeleton or nothing where
 * the component will be, and checks and pictures would read that.
 *
 * @remarks
 * The catalogue's Vite plugin hands every `import()` of the project's code, and of the packages it loads, to the
 * function this module puts on `globalThis` (`vite/trackedImports.ts`); one key on `globalThis` rather than a module's
 * state, so two copies of this module (one pre-bundled, one not) still share it. Only what starts between the story's
 * mount and its first drawing is kept: a story that starts none is ready as soon as it is drawn.
 *
 * @module
 */
import type { ContentState } from "./renderer.ts";
import { STARTED_IMPORTS_KEY_NAME } from "./startedImportsKey.ts";

/** The key of the function a tracked `import()` calls, on `globalThis`. */
const STARTED_IMPORTS_KEY = Symbol.for(STARTED_IMPORTS_KEY_NAME);

/** What a tracked `import()` calls with the promise it started; it returns that promise. */
type ImportTracker = <T>(loading: Promise<T>) => Promise<T>;

/** The list being kept, while a story is first drawn; none otherwise. */
let keeping: Promise<unknown>[] | undefined;

/** The tracker on `globalThis`: keeps a promise while a list is kept, and always hands it back. */
const track: ImportTracker = <T>(loading: Promise<T>): Promise<T> => {
  keeping?.push(loading);
  return loading;
};

/** The imports a story started while first drawn, and a wait for them. */
export type StartedImports = {
  /** Stops keeping: what starts later is not the first drawing's. */
  readonly stop: () => void;
  /** How many imports were kept so far. */
  readonly count: () => number;
  /**
   * Waits until every import kept has settled, resolved or rejected, for so long, in milliseconds.
   *
   * @param timeout - the most to wait, in milliseconds.
   * @returns `settled` at once when none was kept; `waiting` with how many are left when the time ran out.
   */
  readonly settled: (timeout: number) => Promise<ContentState>;
};

/**
 * Starts keeping the imports a story starts, for its first drawing; a list kept for an earlier mount stops.
 *
 * @returns the list's handle.
 */
export const keepStartedImports = (): StartedImports => {
  const holder = globalThis as unknown as Record<symbol, unknown>;
  holder[STARTED_IMPORTS_KEY] ??= track;
  const kept: Promise<unknown>[] = [];
  keeping = kept;
  const stop = (): void => {
    if (keeping === kept) keeping = undefined;
  };
  const settled = async (timeout: number): Promise<ContentState> => {
    if (kept.length === 0) return { state: "settled" };
    let left = kept.length;
    const all = Promise.all(kept.map((loading) => loading.then(noop, noop).finally(() => (left -= 1))));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), timeout);
    });
    const ended = await Promise.race([all, late]).finally(() => clearTimeout(timer));
    if (ended !== "late") return { state: "settled" };
    return {
      state: "waiting",
      reason: `The story still loads ${left} of the ${kept.length} modules it imported while first drawn`
    };
  };
  return { stop, count: () => kept.length, settled };
};

/** Does nothing: an import's value and its failure are the story's, not the wait's. */
const noop = (): void => undefined;
