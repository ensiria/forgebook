/**
 * The patterns of a catalogue's own stories that match no story file, and what the plugin, the commands and the agent API
 * say of them.
 *
 * @module
 */
import type { Logger } from "vite";

import type { ResolvedConfig } from "./configFile.ts";
import { hiddenStoryFolders, hiddenStoryFoldersMessage } from "./hiddenStoryFiles.ts";
import { unmatchedPatterns } from "./storyPatterns.ts";

/**
 * The patterns of a catalogue's own stories that match no story file, each of them a mistake or a first story not yet
 * written: a `forgebook build` stops on them, a dev server says so and waits. A source's patterns are its own module's,
 * which only Vite can read.
 *
 * @param config - the catalogue's folder and stories.
 */
export const emptyStoryGlobs = (config: Pick<ResolvedConfig, "dir" | "stories">): readonly string[] =>
  unmatchedPatterns(config.dir, config.stories);

/**
 * What to say of the patterns of `emptyStoryGlobs`.
 *
 * @param globs - the patterns, at least one.
 */
export const emptyStoryGlobsMessage = (globs: readonly string[]): string =>
  `No story file matches ${globs.map((glob) => `"${glob}"`).join(", ")} (\`stories\` in the configuration)`;

/**
 * What `verify` says of the patterns of `emptyStoryGlobs`, as problems of the catalogue that leave its answer not
 * verified while the rest of it is still given.
 *
 * @param config - the catalogue's folder and stories.
 * @returns one problem naming every such pattern; none when each matches a file.
 */
export const emptyStoryGlobsProblems = (config: Pick<ResolvedConfig, "dir" | "stories">): string[] => {
  const globs = emptyStoryGlobs(config);
  return globs.length === 0
    ? []
    : [
        `${emptyStoryGlobsMessage(globs)}: correct the pattern, or write the first story (npx forgebook new <component file>)`
      ];
};

/**
 * Says what the plugin has to say of the patterns of `emptyStoryGlobs`, and of story files in hidden folders they pass
 * over (`hiddenStoryFolders.ts`), which only warn: a hidden folder may be left out on purpose.
 *
 * @param config - the catalogue's folder and stories.
 * @param isServing - whether a dev server runs: whoever runs one may be about to write the first story, while a build's
 *   reader would find nothing.
 * @param logger - where a dev server's warning goes.
 * @throws in a build, when a pattern matches nothing.
 */
export const sayEmptyStoryGlobs = (
  config: Pick<ResolvedConfig, "dir" | "stories">,
  isServing: boolean,
  logger: Pick<Logger, "warn">
): void => {
  const hidden = hiddenStoryFolders(config);
  if (hidden.length > 0) logger.warn(`Forgebook: ${hiddenStoryFoldersMessage(hidden)}.`);
  const globs = emptyStoryGlobs(config);
  if (globs.length === 0) return;
  if (!isServing) throw new Error(emptyStoryGlobsMessage(globs));
  logger.warn(
    `Forgebook: ${emptyStoryGlobsMessage(globs)}. The catalogue shows them as soon as a file does.`
  );
};
