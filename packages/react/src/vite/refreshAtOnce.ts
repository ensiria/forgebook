/**
 * Applies a Fast Refresh as soon as the hot update that brought it has run, instead of 16 ms later.
 *
 * @remarks
 * React's Fast Refresh runtime (`/@react-refresh`, from `@vitejs/plugin-react`) waits 16 ms after a module's edit before
 * it redraws, to gather the modules of one update. Vite's client runs every module of an update in one go, so a
 * microtask after them gathers the same modules, and an edited component is drawn 16 ms sooner: about a third of the
 * time from an edit to the redraw on a component of Carbon. The runtime is changed only where its text is the one this
 * plugin knows; any other version is served as it is.
 *
 * @module
 */
import type { Plugin } from "vite";

/** The runtime's address, as `@vitejs/plugin-react` serves it. */
const RUNTIME_ID = "/@react-refresh";

/** The runtime's wait before a refresh, as it writes it. */
const DEBOUNCED = /const enqueueUpdate = debounce\(async \(\) => \{\n(.*\n.*\n)\}, 16\)/;

/** A wait for the end of the running task, gathering every call made in it. */
const IN_MICROTASK = `function forgebookAfterTask(fn) {
  let isQueued = false
  return () => {
    if (isQueued) return
    isQueued = true
    queueMicrotask(() => {
      isQueued = false
      fn()
    })
  }
}`;

/**
 * The runtime's code with its refresh run after the update's task instead of 16 ms later.
 *
 * @param code - the runtime's code.
 * @returns the changed code, or `undefined` when the runtime is not the one this knows.
 */
export const refreshedAtOnce = (code: string): string | undefined => {
  if (!DEBOUNCED.test(code)) return undefined;
  return `${code.replace(DEBOUNCED, "const enqueueUpdate = forgebookAfterTask(async () => {\n$1})")}\n${IN_MICROTASK}\n`;
};

/**
 * The plugin.
 *
 * @returns a plugin for the dev server.
 */
export const refreshAtOnce = (): Plugin => ({
  name: "forgebook:react-refresh-at-once",
  apply: "serve",
  transform: {
    filter: { id: new RegExp(`^${RUNTIME_ID}$`) },
    handler: (code: string): string | undefined => refreshedAtOnce(code)
  }
});
