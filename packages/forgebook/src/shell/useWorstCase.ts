/**
 * The stage's worst case: the args the Props tab's button sets, whether the values shown are those, and the spills the
 * story's frames count while they are.
 *
 * @remarks
 * The frames are asked to outline their spills only while the worst case is on (`forgebook:spills`), so a story shown
 * with its own data never pays for the measure; a frame that loads again is asked again when it is ready (`sendTo`).
 * The count is kept by story: in the compare view each frame measures its own, and the last to report is shown.
 *
 * @module
 */
import { type RefObject, useEffect, useMemo, useState } from "react";

import type { PanelProp } from "../argTypes.ts";
import type { PanelArgs, ShellMessage } from "../messages.ts";
import { tellFrames } from "./FrameView.tsx";
import { isWorstCase, type WorstCaseState, worstArgs } from "./worstArgs.ts";

/** What the hook reads. */
export type WorstCaseInput = {
  /** The element that holds the story's frames. */
  readonly storyRef: RefObject<HTMLElement | null>;
  /** The story's id. */
  readonly storyId: string;
  /** The props the panel can set; none before the docs arrive. */
  readonly settable: readonly PanelProp[];
  /** The values shown: the story's args with the panel's over them. */
  readonly values: PanelArgs;
  /** The panel's own values. */
  readonly panelArgs: PanelArgs;
  /** Sets the panel's values. */
  readonly onPanelArgsChange: (args: PanelArgs) => void;
};

/** What the stage does with the worst case. */
export type WorstCase = {
  /** The state the Props tab shows. */
  readonly state: WorstCaseState;
  /** Tells a frame that is ready whether to outline its spills. */
  readonly sendTo: (frame: Window) => void;
  /** Keeps the count a frame reported. */
  readonly receive: (storyId: string, count: number) => void;
};

/**
 * The stage's worst case.
 *
 * @param input - the frames, the story, its settable props and its values.
 */
export const useWorstCase = ({
  storyRef,
  storyId,
  settable,
  values,
  panelArgs,
  onPanelArgsChange
}: WorstCaseInput): WorstCase => {
  const args = useMemo(() => worstArgs(settable), [settable]);
  const isOn = isWorstCase(args, values);
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(new Map());
  useEffect(() => {
    const message: ShellMessage = { type: "forgebook:spills", isOn };
    tellFrames(storyRef.current, message);
  }, [storyRef, isOn]);
  return {
    state: {
      canApply: Object.keys(args).length > 0,
      isOn,
      spillCount: isOn ? counts.get(storyId) : undefined,
      onApply: (): void => onPanelArgsChange({ ...panelArgs, ...args })
    },
    sendTo: (frame: Window): void => {
      const message: ShellMessage = { type: "forgebook:spills", isOn };
      frame.postMessage(message, window.location.origin);
    },
    receive: (reported: string, count: number): void =>
      setCounts((current) => new Map(current).set(reported, count))
  };
};
