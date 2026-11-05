/**
 * A story's panel as its frame reported it once it ran (its `argTypes`, controls, actions and the view it fixes), and
 * what the stage uses before it did.
 *
 * @module
 */
import type { PanelArgTypes } from "../argTypes.ts";
import { NOT_FIXED } from "../storyGlobals.ts";
import type { TreeStory } from "../storyTree.ts";
import type { ReadyMessage } from "./useFrameMessages.ts";

/** The `argTypes` of a story before its frame reported them. */
const NO_ARG_TYPES: PanelArgTypes = {};

/** What a story's frame reports for the panel and the stage. */
export type ReportedPanel = Pick<ReadyMessage, "argTypes" | "controls" | "actions" | "fixed" | "parameters">;

/** No actions, as one value: the panel's docs made from the args are kept while it stays the same. */
const NO_ACTIONS: readonly string[] = [];

/**
 * A story's `argTypes`, controls, actions and fixed view for the panel and the stage: as its frame read them once it ran, which sees a setting
 * written by code the index leaves out; the index's controls and no `argTypes` or actions before.
 *
 * @param panels - what each story's frame reported, by story.
 * @param story - the story.
 */
export const reportedPanel = (panels: ReadonlyMap<string, ReportedPanel>, story: TreeStory): ReportedPanel =>
  panels.get(story.id) ?? {
    argTypes: NO_ARG_TYPES,
    controls: story.controls,
    actions: NO_ACTIONS,
    fixed: NOT_FIXED,
    parameters: []
  };
