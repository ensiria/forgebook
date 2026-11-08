/**
 * The stage's worst case: the args the Props tab's button sets, whether the values shown are those, and the spills the
 * story's frames count while they are.
 *
 * @remarks
 * The frames are asked to outline their spills only while the worst case is on (`forgebook:spills`), so a story shown
 * with its own data never pays for the measure; a frame that loads again is asked again when it is ready (`sendTo`).
 * The count is kept by story and by frame: in the compare view each frame measures its own, and the most is shown.
 *
 * @module
 */
import { type RefObject, useEffect, useMemo, useState } from "react";

import type { PanelProp } from "../argTypes.ts";
import type { ArgValue, PanelArgs, ShellMessage } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { ValueShape } from "../valueShape.ts";
import { tellFrames } from "./FrameView.tsx";
import { framesOrigin } from "./framesOrigin.ts";
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
  /** The source's named values, for a required part only they can fill. */
  readonly namedValues: NamedValues | undefined;
  /** Gives a prop with a shape its worst value, once its module loaded. */
  readonly worstOfShape: ((shape: ValueShape, namedValues: NamedValues) => ArgValue | undefined) | undefined;
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
  readonly receive: (storyId: string, count: number, frame: string) => void;
};

/**
 * The most spills a story's frames counted: the one to fix first; none before any frame counted.
 *
 * @param frames - each frame's count.
 */
const mostOf = (frames: ReadonlyMap<string, number> | undefined): number | undefined =>
  frames === undefined || frames.size === 0 ? undefined : Math.max(...frames.values());

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
  namedValues,
  worstOfShape,
  onPanelArgsChange
}: WorstCaseInput): WorstCase => {
  const args = useMemo(
    () => worstArgs(settable, namedValues, worstOfShape),
    [settable, namedValues, worstOfShape]
  );
  const isOn = isWorstCase(args, values);
  // each frame's count, by story then by frame: the compare view draws a story in several
  const [counts, setCounts] = useState<ReadonlyMap<string, ReadonlyMap<string, number>>>(new Map());
  useEffect(() => {
    const message: ShellMessage = { type: "forgebook:spills", isOn };
    tellFrames(storyRef.current, message);
  }, [storyRef, isOn]);
  return {
    state: {
      canApply: Object.keys(args).length > 0,
      isOn,
      spillCount: isOn ? mostOf(counts.get(storyId)) : undefined,
      onApply: (): void => onPanelArgsChange({ ...panelArgs, ...args })
    },
    sendTo: (frame: Window): void => {
      const message: ShellMessage = { type: "forgebook:spills", isOn };
      frame.postMessage(message, framesOrigin());
    },
    receive: (reported: string, count: number, frame: string): void =>
      setCounts((current) => new Map(current).set(reported, new Map(current.get(reported)).set(frame, count)))
  };
};
