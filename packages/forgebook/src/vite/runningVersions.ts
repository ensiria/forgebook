/**
 * What a catalogue says of the versions it finds itself running with: Forgebook brings its own Vite and React, so an older
 * one of the project's can meet it in two places only, each said where it is met.
 *
 * @module
 */
import type { Logger } from "vite";

import type { ResolvedConfig } from "./configFile.ts";
import { pluginViewsNeedReact } from "./pages.ts";

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

/** What is read of the resolved configuration. */
export type RunningVite = {
  /** Vite's logger. */
  readonly logger: Logger;
  /** Its `build`; none in a test's stand-in. */
  readonly build?: object;
};

/**
 * Stops on a Vite too old, and says what is wrong in a shell's theme and that a plugin's panels cannot draw on the
 * project's React.
 *
 * @param resolved - Vite's resolved configuration.
 * @param config - the catalogue's configuration; none when the plugin was given no catalogue.
 * @throws when Vite is too old.
 */
export const checkAtStart = (resolved: RunningVite, config: ResolvedConfig | undefined): void => {
  assertViteEight(resolved.build);
  // a warning and not a failure: a theme a reader can still use must not stop a catalogue from building
  for (const problem of config?.shell.problems ?? [])
    resolved.logger.warn(`Forgebook's shell theme: ${problem}`);
  if (config !== undefined && pluginViewsNeedReact(config))
    resolved.logger.error(
      "[forgebook] A plugin's panel draws with React 19, and this project has an older React, whose hooks the panel would call: those panels fail. Upgrade React, or leave the plugin out"
    );
};
