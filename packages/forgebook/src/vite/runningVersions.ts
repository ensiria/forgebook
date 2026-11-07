/**
 * What a catalogue says when Vite's configuration is read: what is wrong with its theme, and of the Vite it finds itself running on: the command brings its own, and an app that puts the plugin
 * in its own `vite.config` runs it on the app's.
 *
 * @module
 */
import type { Logger } from "vite";

/**
 * Stops on a Vite older than the one this runs on, for an app that puts this plugin in its own `vite.config`: the command
 * brings its own Vite, and a project's older one would otherwise fail later, at its first watched file, far from here.
 *
 * @param build - the resolved configuration's `build`, which names Rolldown's options from Vite 8 on.
 * @throws when it is an older Vite's.
 */
export const assertViteEight = (build: object | undefined): void => {
  if (build === undefined || "rolldownOptions" in build) return;
  throw new Error(
    "forgebookPlugin runs on Vite 8.3.4 or later, and this vite.config runs on an older one: run the catalogue with the forgebook command, which brings its own, or upgrade Vite"
  );
};

/** What is read of Vite's resolved configuration. */
export type ResolvedVite = {
  /** Vite's logger. */
  readonly logger: Logger;
  /** Its cache folder. */
  readonly cacheDir: string;
  /** Its `build`; none in a test's stand-in. */
  readonly build?: object;
};

/**
 * Stops on a Vite too old, and warns of what will not work in the shell's theme: a warning, since a theme a reader can still
 * use must not stop a catalogue from building.
 *
 * @param resolved - Vite's resolved configuration.
 * @param themeProblems - what will not work in the theme.
 * @throws when Vite is too old.
 */
export const checkAtStart = (resolved: ResolvedVite, themeProblems: readonly string[]): void => {
  assertViteEight(resolved.build);
  for (const problem of themeProblems) resolved.logger.warn(`Forgebook's shell theme: ${problem}`);
};
