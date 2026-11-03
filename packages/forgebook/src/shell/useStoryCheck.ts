/**
 * The accessibility check of the story on the stage: its state, and how to run it in the frame.
 *
 * @module
 */
import { type RefObject, useState } from "react";

import type { ShellMessage } from "../messages.ts";
import type { CheckState } from "./A11yTab.tsx";
import { framesOrigin } from "./framesOrigin.ts";
import type { CheckResult } from "./useFrameMessages.ts";

/**
 * The accessibility check of the shown story: its state, cleared when the story or the view changes, and how to run
 * it in the frame.
 *
 * @param frameRef - the story's frame.
 * @param checkKey - the story and the view, as one text: a check belongs to them.
 */
export const useStoryCheck = (
  frameRef: RefObject<HTMLIFrameElement | null>,
  checkKey: string
): { check: CheckState; run: () => void; receive: (result: CheckResult) => void } => {
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [checkedKey, setCheckedKey] = useState(checkKey);
  if (checkedKey !== checkKey) {
    setCheckedKey(checkKey);
    setCheck({ status: "idle" });
  }
  return {
    check,
    run: (): void => {
      setCheck({ status: "running" });
      const message: ShellMessage = { type: "forgebook:check" };
      frameRef.current?.contentWindow?.postMessage(message, framesOrigin());
    },
    receive: (result: CheckResult): void =>
      setCheck(
        "error" in result
          ? { status: "error", message: result.error }
          : { status: "done", violations: result.violations }
      )
  };
};
