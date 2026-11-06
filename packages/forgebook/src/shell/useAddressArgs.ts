/**
 * The props panel's values an address names, as a page hands them to the story's frames: only those the story declares,
 * with a value of the declared type, once the story's frame and its component's docs say what that is.
 *
 * @remarks
 * The address is written by whoever shares the link, so its values are checked here, in the core, before any frame
 * receives them, whatever framework draws the story (`addressArgs.ts`). Until the story's frame is ready and its docs
 * are read (or known to be missing), no value is sent: the frame draws the story's own args meanwhile.
 *
 * @module
 */
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import {
  type AcceptedArgs,
  type ArgDeclaration,
  type CheckedArgs,
  checkedAddressArgs,
  checkedArgsMessage,
  type DroppedArg,
  declaredArgProps,
  needsShapeChecks
} from "../addressArgs.ts";
import type { AddressLink } from "../addressArgsParam.ts";
import type { ComponentDocs } from "../componentDocs.ts";
import { type PanelArgs, panelArgsParam } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { LoadedChecks } from "./argChecks.ts";
import type { ArgControlLoaders } from "./customControls.ts";
import { tellFrames } from "./FrameView.tsx";
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
  /** What else the address says of them: how to type them, and which could not be read. */
  readonly link: AddressLink | undefined;
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
  /** The catalogue's custom controls; none when it has none. */
  readonly argControls: ArgControlLoaders | undefined;
  /** The element that holds the story's frames, which hear each change of the checked values. */
  readonly frames: RefObject<HTMLElement | null>;
};

/** The address's values once checked, and how to check them for a frame that has just reported ready. */
export type AddressArgs = {
  /** The values the story receives; none before its declaration is known. */
  readonly accepted: PanelArgs;
  /** The same values for a frame that waits for the check; `undefined` until the declaration is known. */
  readonly checked: AcceptedArgs | undefined;
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
  readonly acceptedFor: (ready: ReadyDeclaration) => AcceptedArgs | undefined;
  /** Gives a prop with a shape its worst value, once a prop that needs the checks asked for them. */
  readonly worstOfShape: LoadedChecks["worstOfShape"] | undefined;
};

/** No custom control registered. */
const NO_ARG_CONTROLS: ArgControlLoaders = {};

/**
 * What checks a story's structured values, loaded when a story first has a prop that needs it. Until it arrives such a
 * prop's value waits, whichever its story.
 *
 * @param declaration - what the story declares.
 * @param loaders - the catalogue's custom controls.
 */
const useArgChecks = (
  declaration: ArgDeclaration | undefined,
  loaders: ArgControlLoaders | undefined
): LoadedChecks | undefined => {
  const props = declaration === undefined ? [] : declaredArgProps(declaration);
  const names = props.flatMap((prop) => prop.customControl ?? []).join("\n");
  const isNeeded = props.some(needsShapeChecks);
  const [loaded, setLoaded] = useState<{ readonly names: string; readonly checks: LoadedChecks }>();
  useEffect(() => {
    if (!isNeeded) return;
    let isCurrent = true;
    void import("./argChecks.ts")
      .then(({ loadedChecks }) =>
        loadedChecks(names === "" ? [] : names.split("\n"), loaders ?? NO_ARG_CONTROLS)
      )
      .then((checks) => {
        if (isCurrent) setLoaded({ names, checks });
      });
    return (): void => {
      isCurrent = false;
    };
  }, [isNeeded, names, loaders]);
  return loaded?.names === names ? loaded.checks : undefined;
};

/**
 * The address's values, checked against what the story declares.
 *
 * @param input - the address's values and what the stage knows of the story.
 */
export const useAddressArgs = (input: AddressArgsInput): AddressArgs => {
  const { panelArgs, link, docs, storyArgs, argTypes, controls, frames } = input;
  const typeValue = link?.typeValue;
  const namedValues = input.namedValues ?? NO_NAMED_VALUES;
  const declaration = useMemo(() => {
    const ready = storyArgs === undefined ? undefined : { args: storyArgs, argTypes, controls };
    return declarationOf(docs, ready, namedValues);
  }, [docs, storyArgs, argTypes, controls, namedValues]);
  const checks = useArgChecks(declaration, input.argControls);
  const checked = useMemo((): CheckedArgs | undefined => {
    if (declaration === undefined) return undefined;
    const read = checkedAddressArgs(panelArgs, declaration, typeValue, checks);
    // nothing is told of the address until all of it can be: a story must not draw half a link
    return read.isWaiting ? undefined : read;
  }, [panelArgs, typeValue, declaration, checks]);
  const acceptedParam = checked === undefined ? undefined : panelArgsParam(checked.accepted);
  // the values reach the frames from the address, so going back in the history sets them too; compared as text, so a
  // frame is told again only when they change
  const sealedRef = useRef(checked?.sealed);
  sealedRef.current = checked?.sealed;
  useEffect(() => {
    if (acceptedParam === undefined || sealedRef.current === undefined) return;
    tellFrames(frames.current, checkedArgsMessage(sealedRef.current));
  }, [acceptedParam, frames]);
  // said with the check's: the note's button keeps what the story accepts, which is not known before
  const unread = (link?.unread ?? []).map((name): DroppedArg => ({ name, reason: "unreadable" }));
  return {
    accepted: checked?.accepted ?? NO_ARGS,
    checked: checked?.sealed,
    dropped: checked === undefined ? NOTHING_DROPPED : [...unread, ...checked.dropped],
    acceptedParam,
    acceptedFor: (message: ReadyDeclaration): AcceptedArgs | undefined => {
      const ready = declarationOf(docs, message, namedValues);
      if (ready === undefined) return undefined;
      const read = checkedAddressArgs(panelArgs, ready, typeValue, checks);
      return read.isWaiting ? undefined : read.sealed;
    },
    worstOfShape: checks?.worstOfShape
  };
};
