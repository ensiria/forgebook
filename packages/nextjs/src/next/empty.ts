/**
 * What `server-only` and `client-only` resolve to in a catalogue: nothing.
 *
 * @remarks
 * In Next.js, importing `server-only` from code that reaches the browser fails the build, which keeps server code out
 * of it. A story draws a server component in the browser on purpose, so the guard has nothing to guard there; what the
 * server code itself reaches (a database, the file system) still is not in the browser, and a story mocks it.
 *
 * @module
 */
export {};
