/**
 * The stage's reading of a story's args: the values shown once the panel's are over the story's own, a change of one
 * value, and what an embed of the story keeps of them.
 *
 * @remarks
 * What the panel leaves without a value (`UnsetArg`) is no value from here on: only the address and the frames need to say
 * so. The tab and the code read what the story receives.
 *
 * @module
 */
import { useCallback, useEffect, useRef } from "react";

import {
  type ArgValue,
  isUnsetArg,
  type PanelArgs,
  panelArgsParam,
  parsePanelArgsParam
} from "../messages.ts";
import type { TreeStory } from "../storyTree.ts";
import type { ViewSwitch } from "../switches.ts";
import { type ViewState, viewParams } from "../viewState.ts";

/** The stage's values. */
export type PanelValues = {
  /** The values shown: the story's own, with the panel's over them. */
  readonly values: PanelArgs;
  /** Sets one value: `undefined` takes the panel's away, `UNSET_ARG` leaves the prop with none. */
  readonly change: (name: string, value: ArgValue | undefined) => void;
};

/**
 * The stage's values.
 *
 * @param accepted - the panel's values, once checked.
 * @param own - the story's own args.
 * @param onChange - sets the panel's values.
 */
export const usePanelValues = (
  accepted: PanelArgs,
  own: PanelArgs,
  onChange: (args: PanelArgs) => void
): PanelValues => {
  return {
    values: Object.fromEntries(
      Object.entries({ ...own, ...accepted }).filter(([, value]) => !isUnsetArg(value))
    ),
    // a change starts from the values the story takes: one the address named and the story does not is let go
    change: (name: string, value: ArgValue | undefined): void => {
      const { [name]: _removed, ...rest } = accepted;
      // a prop the story gives nothing has no value already, and the address stays short for it
      const isNothing = value === undefined || (isUnsetArg(value) && own[name] === undefined);
      onChange(isNothing ? rest : { ...rest, [name]: value });
    }
  };
};

/**
 * The address's values once checked, for a frame told them once, when it is ready: a plugin's second frame may be ready
 * while the check still waits for the story's docs, and must neither draw without the values nor receive them unchecked.
 *
 * @param acceptedParam - the values as the address writes them; none before they are known.
 * @returns what gives them when they are known.
 */
export const useCheckedArgs = (acceptedParam: string | undefined): (() => Promise<PanelArgs>) => {
  const param = useRef(acceptedParam);
  param.current = acceptedParam;
  const waiting = useRef<((args: PanelArgs) => void)[]>([]);
  useEffect(() => {
    if (acceptedParam === undefined) return;
    for (const resolve of waiting.current.splice(0)) resolve(parsePanelArgsParam(acceptedParam));
  }, [acceptedParam]);
  return useCallback(
    () =>
      param.current === undefined
        ? new Promise((resolve) => waiting.current.push(resolve))
        : Promise.resolve(parsePanelArgsParam(param.current)),
    []
  );
};

/**
 * Whether a story's args change what it draws: not for a story of fixed examples, nor for one about logic, whose scene
 * takes none.
 *
 * @param story - the story.
 */
export const takesArgs = (story: Pick<TreeStory, "isLogic" | "controls">): boolean =>
  !story.isLogic && (story.controls === "all" || story.controls.length > 0);

/**
 * What an embed of the story keeps of the page: its view and the values set in the panel. An embed draws no device
 * frame, so the device chosen is left out: the embed is the story at the width its iframe gives it.
 *
 * @param view - the reader's view, without what the story fixes, which the story fixes again.
 * @param panelArgs - the values set in the panel, once checked: typed, and only those the story takes.
 * @param switches - the catalogue's switches.
 */
export const embedQuery = (
  view: ViewState,
  panelArgs: PanelArgs,
  switches: readonly ViewSwitch[]
): string => {
  const params = viewParams({ ...view, device: "auto", orientation: "auto" }, switches);
  const args = panelArgsParam(panelArgs);
  if (args !== "") params.set("args", args);
  return params.toString();
};

/**
 * The height an embed's iframe starts at: as tall as the frame is on the stage.
 *
 * @param view - the view, with the height set on the stage.
 * @param contentHeight - the story's content, in CSS px.
 * @param story - the story, with the height its scene declares.
 */
export const embedHeight = (
  view: ViewState,
  contentHeight: number,
  story: Pick<TreeStory, "height">
): number => (view.height === "auto" ? Math.max(contentHeight, story.height ?? 0) : view.height);
