/**
 * Listens to the keys that cycle the toolbar's controls: a control's key moves it to its next value (Shift to the
 * one before), anywhere in the shell but while typing.
 *
 * @module
 */
import { useEffect, useRef } from "react";

import { type ControlKeys, pressedControl } from "../controlKeys.ts";
import type { FixedView } from "../storyGlobals.ts";
import type { ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { cycledView } from "./controlCycle.ts";
import { isTyping } from "./keyboard.ts";

/** What the keys read and change. */
export type ControlKeysInput = {
  /** The keys in use. */
  readonly keys: ControlKeys;
  /** The view shown. */
  readonly view: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
  /** What the shown story fixes of the view. */
  readonly fixed: FixedView;
  /** Whether a story's page is shown. */
  readonly isStoryPage: boolean;
};

/**
 * Listens to the controls' keys.
 *
 * @param input - the keys, the view and its setter, what the story fixes and the page shown.
 */
export const useControlKeys = (input: ControlKeysInput): void => {
  const catalogue = useCatalogue();
  // the latest view and keys, without listening again on every render
  const latest = useRef(input);
  latest.current = input;
  useEffect(() => {
    const cycle = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return;
      const { keys, view, onViewChange, fixed, isStoryPage } = latest.current;
      const pressed = pressedControl(keys, {
        key: event.key,
        shiftKey: event.shiftKey,
        hasModifier: event.metaKey || event.ctrlKey || event.altKey
      });
      if (pressed === undefined) return;
      const changed = cycledView(view, pressed.id, pressed.step, catalogue, fixed, isStoryPage);
      if (changed === undefined) return;
      event.preventDefault();
      onViewChange(changed);
    };
    document.addEventListener("keydown", cycle);
    return (): void => document.removeEventListener("keydown", cycle);
  }, [catalogue]);
};
