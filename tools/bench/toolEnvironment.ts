/**
 * The environment the tools' and the libraries' commands run in: what a program needs to run, never the rest of the
 * developer's or the CI job's variables, and the variables that keep a library's tools from leaving daemons behind.
 *
 * @remarks
 * A real library's install, its `prepare` and its own Storybook run that library's code and its dependencies': the
 * tokens and keys an environment holds (a registry's, a cloud's, the CI's) are not theirs to read. So a command gets
 * the variables listed here, when set, and what its definition adds. The bench kit's variables are listed by name too:
 * they keep every cache in the kit's folder and every tool from asking a question nobody is there to answer. On
 * Windows names are matched whatever their case, as Windows names them (`Path`); elsewhere a name is its case, so a
 * lower-case `http_proxy`, which may hold a password, is not passed on.
 *
 * @module
 */

/**
 * The variables the bench kit's launchers set: the caches in the kit's folder, no download prompt from corepack, and
 * Git with no configuration of the user's and no credentials asked. Git's settings themselves go in the kit's own
 * configuration file, never through `GIT_CONFIG_COUNT` and its pairs: a developer's or a CI's environment puts
 * credentials there (an `http.extraheader`), and a count passed without all its pairs makes every `git` fail.
 */
export const KIT_VARIABLES: readonly string[] = [
  "COREPACK_HOME",
  "COREPACK_ENABLE_DOWNLOAD_PROMPT",
  "COREPACK_ENABLE_AUTO_PIN",
  "npm_config_cache",
  "npm_config_store_dir",
  "npm_config_update_notifier",
  "npm_config_fund",
  "PLAYWRIGHT_BROWSERS_PATH",
  "YARN_GLOBAL_FOLDER",
  "GIT_CONFIG_NOSYSTEM",
  "GIT_CONFIG_GLOBAL",
  "GIT_TERMINAL_PROMPT",
  "GCM_INTERACTIVE"
];

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
  "LOCALAPPDATA",
  "SystemDrive",
  "WINDIR",
  "ProgramData",
  "ProgramFiles",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  ...KIT_VARIABLES
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
 * @param platform - the system, whose rule for the case of a name applies.
 */
export const toolEnvironment = (
  env: Readonly<Record<string, string | undefined>>,
  added: Readonly<Record<string, string>> = {},
  platform: NodeJS.Platform = process.platform
): Record<string, string> => {
  const kept: Record<string, string> = {};
  const key = (name: string): string => (platform === "win32" ? name.toUpperCase() : name);
  const wanted = new Set(KEPT_VARIABLES.map(key));
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && wanted.has(key(name))) kept[name] = value;
  }
  return { ...kept, ...NO_DAEMONS, ...added };
};
