/**
 * The props panel's values an address names, as the stage hands them to the story's frames: only those the story
 * declares, with a value of the declared type, once the story's frame and its component's docs say what that is.
 *
 * @remarks
 * The address is written by whoever shares the link, so its values are checked here, in the core, before any frame
 * receives them, whatever framework draws the story (`addressArgs.ts`). Until the story's frame is ready and its docs
 * are read (or known to be missing), no value is sent: the frame draws the story's own args meanwhile.
 *
 * @module
 */
import { useMemo } from "react";

import {
  type ArgDeclaration,
  type CheckedArgs,
  checkedAddressArgs,
  type DroppedArg
} from "../addressArgs.ts";
import type { ComponentDocs } from "../componentDocs.ts";
import { type PanelArgs, panelArgsParam } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { ReadyMessage } from "./useFrameMessages.ts";
import type { Loaded } from "./useLoaded.ts";

/** What the story's frame reported that the check reads: its own args, its `argTypes` and its controls. */
export type ReadyDeclaration = Pick<ReadyMessage, "args" | "argTypes" | "controls">;

/**
 * What a story declares, once both its frame and its docs answered.
 *
 * @param docs - the component's docs; a story without a component, or whose docs failed, declares no typed props.
 * @param ready - what the story's frame reported; none before it is ready.
 * @param namedValues - the source's named values.
 * @returns the declaration; none while the frame or the docs are still loading.
 */
export const declarationOf = (
  docs: Loaded<ComponentDocs>,
  ready: ReadyDeclaration | undefined,
  namedValues: NamedValues
): ArgDeclaration | undefined => {
  if (ready === undefined || docs.status === "loading") return undefined;
  return {
    props: docs.status === "ready" ? docs.value.props : [],
    argTypes: ready.argTypes,
    controls: ready.controls,
    storyArgs: ready.args,
    namedValues
  };
};

/** No value: what the story receives of the address before its declaration is known. */
const NO_ARGS: PanelArgs = {};

/** No value left out. */
const NOTHING_DROPPED: readonly DroppedArg[] = [];

/** A source without named values. */
const NO_NAMED_VALUES: NamedValues = {};

/** What the stage knows of the story when it checks the address's values. */
export type AddressArgsInput = {
  /** The values the address names. */
  readonly panelArgs: PanelArgs;
  /** The component's docs. */
  readonly docs: Loaded<ComponentDocs>;
  /** The story's own args its frame reported; none before it is ready. */
  readonly storyArgs: PanelArgs | undefined;
  /** The story's `argTypes`, as its frame reported them. */
  readonly argTypes: ReadyDeclaration["argTypes"];
  /** The props the story lets the panel set. */
  readonly controls: ReadyDeclaration["controls"];
  /** The source's named values; none when it has none. */
  readonly namedValues: NamedValues | undefined;
};

/** The address's values once checked, and how to check them for a frame that has just reported ready. */
export type AddressArgs = {
  /** The values the story receives; none before its declaration is known. */
  readonly accepted: PanelArgs;
  /** The values left out, with the reason. */
  readonly dropped: readonly DroppedArg[];
  /**
   * The accepted values as the address writes them, to tell the frames only when they change; none before the
   * declaration is known, when no frame is told anything.
   */
  readonly acceptedParam: string | undefined;
  /**
   * The values to send a frame that has just reported ready, from its own message, since the state that holds it
   * updates after; none while the docs load.
   */
  readonly acceptedFor: (ready: ReadyDeclaration) => PanelArgs | undefined;
};

/**
 * The address's values, checked against what the story declares.
 *
 * @param input - the address's values and what the stage knows of the story.
 */
export const useAddressArgs = (input: AddressArgsInput): AddressArgs => {
  const { panelArgs, docs, storyArgs, argTypes, controls } = input;
  const namedValues = input.namedValues ?? NO_NAMED_VALUES;
  const checked = useMemo((): CheckedArgs | undefined => {
    const ready = storyArgs === undefined ? undefined : { args: storyArgs, argTypes, controls };
    const declaration = declarationOf(docs, ready, namedValues);
    return declaration === undefined ? undefined : checkedAddressArgs(panelArgs, declaration);
  }, [panelArgs, docs, storyArgs, argTypes, controls, namedValues]);
  return {
    accepted: checked?.accepted ?? NO_ARGS,
    dropped: checked?.dropped ?? NOTHING_DROPPED,
    acceptedParam: checked === undefined ? undefined : panelArgsParam(checked.accepted),
    acceptedFor: (message: ReadyDeclaration): PanelArgs | undefined => {
      const declaration = declarationOf(docs, message, namedValues);
      return declaration === undefined ? undefined : checkedAddressArgs(panelArgs, declaration).accepted;
    }
  };
};
