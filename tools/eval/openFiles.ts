/**
 * A command run with room for the files it opens: a dev server's file watcher (Nuxt's, Vite's on a large app) opens one
 * per file, and macOS gives a process started from a terminal 256, so `nuxt dev` died with "too many open files" under
 * the agent and under the measurement alike.
 *
 * @module
 */

/** How many open files a command may have, when the system allows that many. */
export const OPEN_FILES = 65_536;

/** A program and its arguments. */
type Invocation = { readonly program: string; readonly args: readonly string[] };

/**
 * The command run through a shell that first raises its open-file limit, to {@link OPEN_FILES} or else to the system's
 * hard limit; as it is on Windows, which has no such limit.
 *
 * @param command - the program and its arguments, as `spawn` takes them.
 * @param platform - the system it runs on.
 */
export const withOpenFiles = (
  command: Invocation,
  platform: NodeJS.Platform = process.platform
): Invocation => {
  if (platform === "win32") return command;
  const raise = `ulimit -n ${OPEN_FILES} 2>/dev/null || ulimit -n "$(ulimit -Hn)" 2>/dev/null; exec "$0" "$@"`;
  return { program: "/bin/sh", args: ["-c", raise, command.program, ...command.args] };
};
