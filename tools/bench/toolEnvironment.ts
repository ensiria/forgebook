/**
 * The environment the tools' and the libraries' commands run in: what a program needs to run, never the rest of the
 * developer's or the CI job's variables, and the variables that keep a library's tools from leaving daemons behind.
 *
 * @remarks
 * A real library's install, its `prepare` and its own Storybook run that library's code and its dependencies': the
 * tokens and keys an environment holds (a registry's, a cloud's, the CI's) are not theirs to read. So a command gets
 * the variables listed here, when set, and what its definition adds.
 *
 * @module
 */

/** The variables a command keeps from the harness's environment: paths, locale, terminal, proxies, Windows' basics. */
export const KEPT_VARIABLES: readonly string[] = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "CI",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA"
];

/** The variables that keep a library's tools from starting a daemon that outlives the command. */
export const NO_DAEMONS: Readonly<Record<string, string>> = {
  // Nx's daemon and the workers of its plugins
  NX_DAEMON: "false",
  NX_ISOLATE_PLUGINS: "false",
  // Turborepo's daemon
  TURBO_DAEMON: "false"
};

/**
 * A command's environment: the kept variables of the harness's, the daemons turned off, then the command's own.
 *
 * @param env - the harness's environment.
 * @param added - what the command adds.
 */
export const toolEnvironment = (
  env: Readonly<Record<string, string | undefined>>,
  added: Readonly<Record<string, string>> = {}
): Record<string, string> => {
  const kept: Record<string, string> = {};
  for (const name of KEPT_VARIABLES) {
    const value = env[name];
    if (value !== undefined) kept[name] = value;
  }
  return { ...kept, ...NO_DAEMONS, ...added };
};
