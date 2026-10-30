/**
 * The view's live part on the frames of a page: the frames load once with the view they need, and a change of the
 * theme, contrast, motion, speed, press feedback, backdrop or text size is sent to them, so their stories keep their
 * state.
 *
 * @remarks
 * Only another story, other style sheets or another language load a frame again: those change its document. The
 * story page and the component page use both hooks.
 *
 * @module
 */
import { type RefObject, useEffect, useState } from "react";

import { MEASURE_TOOLS, type MeasureTool, type ViewState } from "../viewState";
import { tellFrames } from "./FrameView";

/** The tools a joined list names, back as a list (the effect depends on the text, not on a new list each render). */
const toolsOf = (joined: string): MeasureTool[] =>
  MEASURE_TOOLS.filter((tool) => joined.split(",").includes(tool));

/**
 * The view the frames load with: the current one when the load key changes, otherwise the one they loaded with.
 *
 * @param loadKey - what loads the frames again (the story, the style sheets, the language), as one text.
 * @param view - the current view.
 */
export const useLoadedView = (loadKey: string, view: ViewState): ViewState => {
  const [loaded, setLoaded] = useState({ key: loadKey, view });
  // set while rendering, as React allows for a value derived from props: the frames never get a stale address
  if (loaded.key !== loadKey) setLoaded({ key: loadKey, view });
  return loaded.key === loadKey ? loaded.view : view;
};

/**
 * Sends the view's live part to every frame in a container whenever it changes, and the tools drawn over them.
 *
 * @param container - the element that holds the frames.
 * @param view - the current view.
 * @param isEnabled - whether the frames follow the view (the compare view's frames fix their own theme).
 */
export const useLiveView = (
  container: RefObject<HTMLElement | null>,
  view: ViewState,
  isEnabled: boolean
): void => {
  const { theme, isMoreContrast, motion, speed, press, backdrop, text } = view;
  useEffect(() => {
    if (!isEnabled) return;
    tellFrames(container.current, {
      type: "forgebook:view",
      view: { theme, isMoreContrast, motion, speed, press, backdrop, text }
    });
  }, [container, theme, isMoreContrast, motion, speed, press, backdrop, text, isEnabled]);
  // the tools draw over every frame, the compare view's too
  const tools = view.tools.join(",");
  useEffect(() => {
    tellFrames(container.current, { type: "forgebook:tools", tools: toolsOf(tools) });
  }, [container, tools]);
};
