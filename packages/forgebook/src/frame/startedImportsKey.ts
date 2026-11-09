/**
 * The name of the `globalThis` symbol (`Symbol.for`) through which a module's wrapped `import()` reaches the frame's
 * tracker: shared by the plugin that writes the wrapper and the frame that answers it.
 *
 * @module
 */

/** The symbol's name. */
export const STARTED_IMPORTS_KEY_NAME = "forgebook.startedImports";
