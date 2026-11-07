/**
 * A frame's answer to the shell's Check: the story's accessibility, or why it cannot be checked.
 *
 * @module
 */
import type { A11ySettings } from "../catalogue.ts";
import type { ShellChannel } from "./shellChannel.ts";

/**
 * Checks the story's accessibility and tells the shell the result.
 *
 * @param storyId - the story's id, for the answers.
 * @param pendingReason - why the story was not seen in its final state, if so: answered instead of a check.
 * @param rules - the catalogue's accessibility rules; none when it checks no accessibility.
 * @param axeUrl - the address of axe's script.
 * @param tellShell - tells the shell the check's result.
 */
export const checkForShell = (
  storyId: string,
  pendingReason: string | undefined,
  rules: A11ySettings | undefined,
  axeUrl: string | undefined,
  tellShell: ShellChannel["tell"]
): void => {
  // loaded on the first check: a frame that is never checked, or one of a catalogue that checks nothing, never
  // fetches the code that loads axe
  const refusal =
    pendingReason ??
    (rules === undefined ? "The catalogue checks no accessibility (a11y: false)" : undefined);
  const checked =
    refusal !== undefined || rules === undefined
      ? Promise.reject(new Error(refusal))
      : import("./checkStory.ts").then((module) => module.checkStory(document, rules, axeUrl));
  checked
    .then((violations) => tellShell({ type: "forgebook:checked", storyId, violations }))
    .catch((error: unknown) =>
      tellShell({
        type: "forgebook:check-error",
        storyId,
        message: error instanceof Error ? error.message : String(error)
      })
    );
};
