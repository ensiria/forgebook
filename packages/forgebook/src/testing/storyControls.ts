/**
 * Whether a story's controls tell the truth: the props panel shows a control only when changing it changes the story.
 *
 * @remarks
 * A render that ignores its args draws fixed examples, so its args reach nothing: it declares
 * `parameters.controls: false`. A render ignores its args when it takes no parameter, or when its first parameter is
 * named with a leading underscore, the convention for a parameter left unused: a fixed story that reads its texts
 * takes the context as its second parameter (`(_args, { text }) => …`). A story that declares no controls must have a
 * render that ignores its args: without a render the component takes them, and a render that reads them follows them,
 * unless the only arg it follows is the one its Replay toggles (an arrival replayed on demand), which the panel does
 * not drive. The parameters are read from the function's `length` and its source, so a render written `(args) => …`
 * that ignores them is not caught. Pure: story in, problem out.
 *
 * @module
 */
import type { LoadedStory } from "../frame/storyModule";

/** A function's source that opens on a first parameter named with a leading underscore: `(_args, …) => …`. */
const FIRST_PARAMETER_UNUSED = /^(?:async\s*)?(?:function\b[^(]*)?\(\s*_/;

/**
 * Whether a render ignores its args: it takes no parameter, or names its first one as unused (`_args`).
 *
 * @param render - the story's render.
 */
const ignoresArgs = (render: NonNullable<LoadedStory["render"]>): boolean =>
  render.length === 0 || FIRST_PARAMETER_UNUSED.test(render.toString());

/**
 * What is wrong with a story's controls, or `undefined` when nothing is.
 *
 * @param story - the loaded story.
 * @returns why the panel would show controls that do nothing, or hide ones that work.
 */
export const storyControlsProblem = (story: LoadedStory): string | undefined => {
  if (story.component === undefined) return undefined;
  const isFixed = story.render !== undefined && ignoresArgs(story.render);
  const hasNoControls = story.controls !== "all" && story.controls.length === 0;
  if (isFixed && !hasNoControls) {
    return "its render ignores its args, so the panel's controls would change nothing: declare `parameters.controls: false`";
  }
  const isReplayDriven = story.render !== undefined && typeof story.replay === "object";
  if (!isFixed && hasNoControls && !isReplayDriven) {
    return "it declares `parameters.controls: false` but its args reach the story: remove it, or list the props it reads";
  }
  return undefined;
};
