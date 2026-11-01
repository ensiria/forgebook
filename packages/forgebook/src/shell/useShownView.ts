/**
 * The view the shown story is drawn with, and its change back to the address: a story marked for a phone has its own
 * Touch, and a story about logic is never compared.
 *
 * @remarks
 * The toolbar and the stage read and change this view; the address keeps what belongs to the other stories (the
 * Touch switch they follow, the compare they share). The view is kept while nothing it is made of changes: a new
 * switches' object would send the frame the view again.
 *
 * @module
 */
import { useMemo } from "react";

import type { TreeStory } from "../storyTree.ts";
import type { TouchChoice } from "../switches.ts";
import type { ViewState } from "../viewState.ts";
import { logicView, logicViewChange } from "./logicView.ts";
import { storyTouchesOf, storyViewChange, type TouchOverrides, touchedView } from "./storyTouch.ts";

/** The shown story's view and how to change it. */
export type ShownView = {
  /** The view the story is drawn with. */
  readonly view: ViewState;
  /** Changes it: the story's own parts to the story, the rest to the address. */
  readonly onViewChange: (view: ViewState) => void;
  /** Whether the shown story is about logic; `false` on another page. */
  readonly isLogic: boolean;
};

/** What the shown story's view is made of. */
export type ShownViewInput = {
  /** The address's view. */
  readonly addressView: ViewState;
  /** The shown story; none on another page. */
  readonly story: TreeStory | undefined;
  /** The user's choice for each story marked for a phone. */
  readonly touchOverrides: TouchOverrides;
  /** Sets the user's choice for a story marked for a phone. */
  readonly onTouchChange: (storyId: string, isTouch: boolean) => void;
  /** The catalogue's touch switch. */
  readonly touch: TouchChoice | undefined;
  /** Changes the address's view. */
  readonly onAddressViewChange: (view: ViewState) => void;
};

/**
 * The shown story's view.
 *
 * @param input - the address's view, the story, the touch choices and the address's setter.
 */
export const useShownView = (input: ShownViewInput): ShownView => {
  const { addressView, story, touchOverrides, touch } = input;
  const isLogic = story?.isLogic === true;
  const view = useMemo(
    () =>
      logicView(
        touchedView(
          addressView,
          story?.id,
          storyTouchesOf(story === undefined ? [] : [story], touchOverrides),
          touch
        ),
        isLogic
      ),
    [addressView, story, touchOverrides, touch, isLogic]
  );
  const onViewChange = (next: ViewState): void => {
    if (story === undefined) {
      input.onAddressViewChange(next);
      return;
    }
    const change = storyViewChange(next, addressView, story, touch);
    if (change.isTouch !== undefined) input.onTouchChange(story.id, change.isTouch);
    input.onAddressViewChange(logicViewChange(change.view, addressView, isLogic));
  };
  return { view, onViewChange, isLogic };
};
